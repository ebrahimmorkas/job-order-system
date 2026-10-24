const JobOrder = require('../models/JobOrder');
const common = require('../utils/common');

// "My work": the job orders where the logged-in user was given a master
// value's work (JobOrder masters.values.assignedTo). Read only, and without
// any money - prices, the subtotal, tax and total are left out.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (value) => String(value);

const LIST_FIELDS = '_id jobOrderNumber customer.countryName customer.stateName customer.cityName masters createdAt';
const VIEW_FIELDS = '_id jobOrderNumber customer masters controls images createdAt updatedAt';

// The values of a job order given to the user, each with who else does it.
const workOf = (masters, userId) => {
    try {
        const work = [];
        for (const master of masters) {
            for (const value of master.values) {
                if (!value.assignedTo.some((person) => idOf(person.userId) === userId)) continue;
                work.push({
                    masterName: master.name,
                    valueName: value.name,
                    assignedAt: value.assignedAt ?? null,
                    completeIn: value.completeIn ?? null,
                    dueAt: value.dueAt ?? null,
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

// GET /api/my-work/:id - only a job order given to the user.
const getMyWorkJobOrder = async ({ vendorId, userId, id }) => {
    try {
        const jobOrder = await JobOrder.findOne({ _id: id, vendorId, 'masters.values.assignedTo.userId': userId, status: 'A' })
            .select(VIEW_FIELDS).lean();
        if (!jobOrder) return common.returnResult(false, 404, 'Job order not found.');
        return common.returnResult(true, 200, 'Job order fetched successfully.', {
            jobOrder: {
                ...jobOrder,
                controls: jobOrder.controls.filter((control) => !control.isPrice)
                    .map(({ isPrice, isPriceIncludedInTax, amount, ...control }) => control)
            },
            work: workOf(jobOrder.masters, idOf(userId))
        });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    listMyWork,
    getMyWorkJobOrder
};
