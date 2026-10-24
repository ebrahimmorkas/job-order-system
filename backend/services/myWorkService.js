const mongoose = require('mongoose');
const JobOrder = require('../models/JobOrder');
const common = require('../utils/common');
const stepService = require('./stepService');
const notificationService = require('./notificationService');
const { addDuration } = require('../utils/days');
const { FIXED_STEPS, WORK_TIME_STARTS, STEP_HISTORY_MAX } = require('../constants/stepConstants');

// "My work": the job orders where the logged-in user was given a master
// value's work (JobOrder masters.values.assignedTo). Read only, and without
// any money - prices, the subtotal, tax and total are left out. With the
// steps feature on, the user moves their own work through the vendor's steps.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (value) => String(value);

const LIST_FIELDS = '_id jobOrderNumber customer.countryName customer.stateName customer.cityName masters createdAt';
const VIEW_FIELDS = '_id jobOrderNumber customer masters controls images createdAt updatedAt';

// The values of a job order given to the user, each with who else does it,
// when it is due and the user's step (withHistory: every step so far).
const workOf = (masters, userId, { withHistory = false } = {}) => {
    try {
        const work = [];
        for (const master of masters) {
            for (const value of master.values) {
                const me = value.assignedTo.find((person) => idOf(person.userId) === userId);
                if (!me) continue;
                work.push({
                    valueId: value.valueId,
                    masterName: master.name,
                    valueName: value.name,
                    assignedAt: value.assignedAt ?? null,
                    completeIn: value.completeIn ?? null,
                    timeStartsOn: value.timeStartsOn || WORK_TIME_STARTS.ON_ASSIGN,
                    // Their own due time when the time starts on the first step.
                    dueAt: me.dueAt ?? value.dueAt ?? null,
                    startedAt: me.startedAt ?? null,
                    step: me.step ?? null,
                    ...(withHistory && { history: me.history || [] }),
                    coWorkers: value.assignedTo.filter((person) => idOf(person.userId) !== userId).map((person) => person.name)
                });
            }
        }
        return work;
    } catch (err) {
        throw err;
    }
};

// GET /api/my-work - newest first; search by number or customer place.
const listMyWork = async ({ vendorId, userId, search, page, limit }) => {
    try {
        const filter = { vendorId, 'masters.values.assignedTo.userId': userId, status: 'A' };
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ jobOrderNumber: pattern }, { 'customer.cityName': pattern }, { 'customer.stateName': pattern }, { 'customer.countryName': pattern }];
        }
        const [total, jobOrders] = await Promise.all([
            JobOrder.countDocuments(filter),
            JobOrder.find(filter).select(LIST_FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean()
        ]);
        const me = idOf(userId);
        return common.returnResult(true, 200, 'Your work fetched successfully.', {
            jobOrders: jobOrders.map(({ masters, ...jobOrder }) => ({ ...jobOrder, work: workOf(masters, me) })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/my-work/:id - only a job order given to the user; with the
// vendor's steps to move the work through (none while steps are off).
const getMyWorkJobOrder = async ({ vendorId, userId, id, websiteMasterData, companyMasterData }) => {
    try {
        const jobOrder = await JobOrder.findOne({ _id: id, vendorId, 'masters.values.assignedTo.userId': userId, status: 'A' })
            .select(VIEW_FIELDS).lean();
        if (!jobOrder) return common.returnResult(false, 404, 'Job order not found.');
        return common.returnResult(true, 200, 'Job order fetched successfully.', {
            jobOrder: {
                ...jobOrder,
                controls: jobOrder.controls.filter((control) => !control.isPrice)
                    .map(({ isPrice, isPriceIncludedInTax, amount, ...control }) => control),
                // Other people's steps are theirs only.
                masters: jobOrder.masters.map((master) => ({
                    ...master,
                    values: master.values.map((value) => ({ ...value, assignedTo: value.assignedTo.map(({ userId: personId, name }) => ({ userId: personId, name })) }))
                }))
            },
            work: workOf(jobOrder.masters, idOf(userId), { withHistory: true }),
            steps: stepService.stepsOf(websiteMasterData, companyMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/my-work/:id/step - the user moves their work on one value to a
// step (any step, any time). In progress takes a % (optional), Hold a reason
// (optional). The first change is their start; when the time starts on the
// first step, it also sets when they are due.
const setMyStep = async ({ vendorId, userId, id, data, websiteMasterData, companyMasterData }) => {
    try {
        const step = stepService.stepsOf(websiteMasterData, companyMasterData).find((entry) => entry.key === data.stepKey);
        if (!step) return common.returnResult(false, 400, 'This step is no longer available. Please reload the page.', { errors: [{ field: 'stepKey', message: 'This step is no longer available' }] });

        const jobOrder = await JobOrder.findOne({ _id: id, vendorId, 'masters.values.assignedTo.userId': userId, status: 'A' })
            .select('jobOrderNumber masters.masterId masters.values.valueId masters.values.name masters.values.completeIn masters.values.timeStartsOn masters.values.assignedTo.userId masters.values.assignedTo.name masters.values.assignedTo.startedAt')
            .lean();
        const me = idOf(userId);
        let found = null;
        for (const master of jobOrder?.masters || []) {
            const value = master.values.find((entry) => idOf(entry.valueId) === data.valueId);
            const person = value?.assignedTo.find((entry) => idOf(entry.userId) === me);
            if (person) found = { master, value, person };
        }
        if (!found) return common.returnResult(false, 404, 'This work is no longer given to you.');

        const now = new Date();
        const entry = {
            key: step.key,
            name: step.name,
            fixedStep: step.fixedStep,
            percent: step.fixedStep === FIXED_STEPS.IN_PROGRESS ? data.percent ?? null : null,
            holdReason: step.fixedStep === FIXED_STEPS.HOLD ? data.holdReason ?? null : null,
            at: now
        };
        const path = 'masters.$[m].values.$[v].assignedTo.$[p]';
        const set = { [`${path}.step`]: entry };
        if (!found.person.startedAt) {
            set[`${path}.startedAt`] = now;
            if (found.value.timeStartsOn === WORK_TIME_STARTS.ON_FIRST_STEP && found.value.completeIn) {
                set[`${path}.dueAt`] = addDuration(now, found.value.completeIn);
            }
        }
        const result = await JobOrder.updateOne(
            { _id: id, vendorId, status: 'A' },
            { $set: set, $push: { [`${path}.history`]: { $each: [entry], $slice: -STEP_HISTORY_MAX } } },
            {
                arrayFilters: [
                    { 'm.masterId': found.master.masterId },
                    { 'v.valueId': new mongoose.Types.ObjectId(data.valueId) },
                    { 'p.userId': new mongoose.Types.ObjectId(me) }
                ],
                // A step change isn't an edit of the job order: its "last updated" stays.
                timestamps: false,
                auditUserId: userId
            }
        );
        if (result.matchedCount === 0) return common.returnResult(false, 404, 'This work is no longer given to you.');
        notificationService.inBackground('Announcing a step change failed', () => notificationService.announceStep({
            vendorId, jobOrderId: jobOrder._id, jobOrderNumber: jobOrder.jobOrderNumber, valueName: found.value.name, workerName: found.person.name, step: entry
        }));
        return common.returnResult(true, 200, `Moved to ${step.name}.`, { step: entry });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    listMyWork,
    getMyWorkJobOrder,
    setMyStep
};
