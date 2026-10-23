const Master = require('../models/Master');
const MasterValue = require('../models/MasterValue');
const Role = require('../models/Role');
const common = require('../utils/common');
const { LIVE_STATUSES } = require('../constants/masterConstants');

// The vendor's masters (dropdown lists) and their values. Every function is
// scoped by vendorId, so one vendor can never see or touch another's.
//
// Limits come only from the vendor's CompanyMaster (numberOfMastersAllowed,
// numberOfValuesAllowedInMaster) and count active + inactive, never deleted.
// While a limit is empty nothing can be created.

const LIVE = { $in: LIVE_STATUSES };
const MASTER_FIELDS = '_id name shortName isRequired isMultiselectAllowed isRoleProvided defaultValueId precedence status updatedAt';
const VALUE_FIELDS = '_id name precedence status';

const pick = (doc, fields) => {
    const out = {};
    for (const field of fields.split(' ')) out[field] = doc[field];
    return out;
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const limitNotSet = () => common.returnResult(false, 403, 'Masters have not been set up for your account yet. Please contact support.');

const limitsOf = (companyMasterData) => ({
    mastersAllowed: companyMasterData?.numberOfMastersAllowed ?? null,
    valuesAllowedPerMaster: companyMasterData?.numberOfValuesAllowedInMaster ?? null
});

const tooManyValues = (valuesAllowedPerMaster) => {
    const message = `A master can have at most ${valuesAllowedPerMaster} values.`;
    return common.returnResult(false, 400, message, { errors: [{ field: 'values', message }] });
};

// The fields that record who changed the status and when (same as common.toggleActiveStatus).
const statusFields = (status, userId, now) => (status === 'A'
    ? { status, activeMarkedBy: userId, activeMarkedDate: now }
    : { status, inActiveMarkedBy: userId, inactiveMarkedDate: now });

// A unique index refused the write: which field clashed, as a 409 the form
// can show next to that field. null for any other error.
const duplicateResult = (err, data) => {
    try {
        if (err?.code !== 11000) return null;
        if (Object.keys(err.keyPattern || {}).includes('shortName')) {
            const message = `The short name "${data.shortName}" is already used by another master.`;
            return common.returnResult(false, 409, message, { errors: [{ field: 'shortName', message }] });
        }
        const message = `A master named "${data.name}" already exists.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'name', message }] });
    } catch (error) {
        throw error;
    }
};

// ---- roles using a master ----------------------------------------------------

// A master given in roles can't stop being role-provided or be deleted:
// a 409 naming those roles, or null when no role uses it.
const usedByRolesResult = async ({ vendorId, id, action }) => {
    try {
        const roles = await Role.find({ vendorId, status: LIVE, 'masters.masterId': id }).select('name').limit(4).lean();
        if (roles.length === 0) return null;
        const names = roles.slice(0, 3).map((role) => `"${role.name}"`).join(', ') + (roles.length > 3 ? ' and more' : '');
        const message = `This master is used by the role${roles.length > 1 ? 's' : ''} ${names}. Remove it from ${roles.length > 1 ? 'them' : 'it'} first, then ${action}.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'isRoleProvided', message }] });
    } catch (err) {
        throw err;
    }
};

// Deleted values leave every role; a role entry left with no value goes too.
const removeValuesFromRoles = async ({ vendorId, userId, id, valueIds }) => {
    try {
        if (valueIds.length === 0) return;
        const filter = { vendorId, status: LIVE, 'masters.masterId': id };
        await Role.updateMany(filter, { $pull: { 'masters.$[].valueIds': { $in: valueIds } } }, { auditUserId: userId });
        await Role.updateMany(filter, { $pull: { masters: { masterId: id, isWholeMaster: false, valueIds: { $size: 0 } } } }, { auditUserId: userId });
    } catch (err) {
        throw err;
    }
};

// ---- masters --------------------------------------------------------------

// GET /api/masters - one page, in dropdown order, with each master's number
// of values and the vendor's limits.
const listMasters = async ({ vendorId, search, status, page, limit, companyMasterData }) => {
    try {
        const filter = { vendorId, status: status || LIVE };
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ name: pattern }, { shortName: pattern }];
        }
        const isUnfiltered = !search && !status;

        const [total, masters, mastersUsed] = await Promise.all([
            Master.countDocuments(filter),
            Master.find(filter).select(MASTER_FIELDS).sort({ precedence: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            // The limit counts every live master, whatever the filter shows.
            isUnfiltered ? null : Master.countDocuments({ vendorId, status: LIVE })
        ]);

        const valueCounts = masters.length === 0 ? [] : await MasterValue.aggregate([
            { $match: { vendorId, masterId: { $in: masters.map((m) => m._id) }, status: LIVE } },
            { $group: { _id: '$masterId', count: { $sum: 1 } } }
        ]);
        const countByMaster = new Map(valueCounts.map((row) => [String(row._id), row.count]));

        return common.returnResult(true, 200, 'Masters fetched successfully.', {
            masters: masters.map((master) => ({ ...master, valuesCount: countByMaster.get(String(master._id)) || 0 })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            limits: { ...limitsOf(companyMasterData), mastersUsed: isUnfiltered ? total : mastersUsed }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/masters/:id - the master with its values (not deleted), in order.
const getMaster = async ({ vendorId, id, companyMasterData }) => {
    try {
        const [master, values] = await Promise.all([
            Master.findOne({ _id: id, vendorId, status: LIVE }).select(MASTER_FIELDS).lean(),
            MasterValue.find({ vendorId, masterId: id, status: LIVE }).select(VALUE_FIELDS).sort({ precedence: 1 }).lean()
        ]);
        if (!master) return common.returnResult(false, 404, 'Master not found.');
        return common.returnResult(true, 200, 'Master fetched successfully.', {
            master: { ...master, values },
            limits: limitsOf(companyMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// POST /api/masters - the master and its values together (also used to save
// a copy). Values keep the order they were sent in.
const createMaster = async ({ vendorId, userId, data, companyMasterData }) => {
    try {
        const { mastersAllowed, valuesAllowedPerMaster } = limitsOf(companyMasterData);
        if (!Number.isInteger(mastersAllowed) || !Number.isInteger(valuesAllowedPerMaster)) return limitNotSet();
        if (data.values.length > valuesAllowedPerMaster) return tooManyValues(valuesAllowedPerMaster);

        const [mastersUsed, precedence] = await Promise.all([
            Master.countDocuments({ vendorId, status: LIVE }),
            common.nextPrecedence(Master, { vendorId })
        ]);
        if (mastersUsed >= mastersAllowed) {
            return common.returnResult(false, 403, `You can have at most ${mastersAllowed} masters. Delete one you no longer need to add another.`);
        }

        let master;
        try {
            master = await Master.create({
                vendorId,
                name: data.name,
                shortName: data.shortName,
                isRequired: data.isRequired,
                isMultiselectAllowed: data.isMultiselectAllowed,
                isRoleProvided: data.isRoleProvided,
                precedence
            });
        } catch (err) {
            const duplicate = duplicateResult(err, data);
            if (duplicate) return duplicate;
            throw err;
        }

        try {
            // insertMany skips the save hook that fills createdBy, so it is set here.
            const inserted = await MasterValue.insertMany(data.values.map((value, index) => ({
                vendorId, masterId: master._id, name: value.name, status: value.status, precedence: index + 1, createdBy: userId
            })));
            const defaultIndex = data.values.findIndex((value) => value.isDefault);
            if (defaultIndex !== -1) {
                master.defaultValueId = inserted[defaultIndex]._id;
                await Master.updateOne({ _id: master._id, vendorId }, { $set: { defaultValueId: master.defaultValueId } }, { auditUserId: userId });
            }
        } catch (err) {
            // No transactions yet: undo the master so no master is left without values.
            await Master.deleteOne({ _id: master._id, vendorId }, { auditUserId: userId });
            throw err;
        }

        return common.returnResult(true, 201, 'Master created.', { master: pick(master, MASTER_FIELDS) });
    } catch (err) {
        throw err;
    }
};

// Brings the master's values in line with `values` (the full list, in
// order): values with an _id are existing ones (name / status / order may
// change), values without one are new, existing ones left out are deleted.
// Only what actually changed is written. Returns the id of the value marked
// isDefault (it may be a new one), or null.
const saveValues = async ({ vendorId, userId, id, values, current }) => {
    try {
        const now = new Date();
        const currentById = new Map(current.map((value) => [String(value._id), value]));
        const keptIds = new Set(values.filter((value) => value._id).map((value) => value._id));

        // 1. Deleted first, so their names are free for the renames and new values below.
        const removedIds = current.filter((value) => !keptIds.has(String(value._id))).map((value) => value._id);
        if (removedIds.length > 0) {
            await MasterValue.updateMany(
                { _id: { $in: removedIds }, vendorId, masterId: id, status: LIVE },
                { $set: { status: 'D', deletedBy: userId, deletedDate: now } },
                { auditUserId: userId }
            );
            await removeValuesFromRoles({ vendorId, userId, id, valueIds: removedIds });
        }

        const changes = [];
        values.forEach((value, index) => {
            if (!value._id) return;
            const before = currentById.get(value._id);
            const set = {};
            if (before.name !== value.name) set.name = value.name;
            if (before.precedence !== index + 1) set.precedence = index + 1;
            if (before.status !== value.status) Object.assign(set, statusFields(value.status, userId, now));
            if (Object.keys(set).length > 0) changes.push({ id: value._id, set });
        });

        // 2. A rename onto a name another kept value still holds (e.g. two
        // values swapping names) would trip the unique index mid-way: those
        // first move to a temporary name, then get theirs once the rest are done.
        const heldBy = new Map(current.filter((value) => keptIds.has(String(value._id)))
            .map((value) => [value.name.toLowerCase(), String(value._id)]));
        const isBlocked = (change) => change.set.name !== undefined
            && heldBy.has(change.set.name.toLowerCase()) && heldBy.get(change.set.name.toLowerCase()) !== change.id;
        const blocked = changes.filter(isBlocked);
        const update = (changeId, set) => MasterValue.updateOne({ _id: changeId, vendorId, masterId: id }, { $set: set }, { auditUserId: userId });

        await Promise.all(blocked.map((change) => update(change.id, { name: `~${change.id}` })));
        await Promise.all(changes.filter((change) => !isBlocked(change)).map((change) => update(change.id, change.set)));
        await Promise.all(blocked.map((change) => update(change.id, change.set)));

        // 3. New values, last - any name they take has been freed above.
        const added = values
            .map((value, index) => ({ value, index }))
            .filter(({ value }) => !value._id)
            .map(({ value, index }) => ({ vendorId, masterId: id, name: value.name, status: value.status, precedence: index + 1, createdBy: userId }));
        const inserted = added.length > 0 ? await MasterValue.insertMany(added) : [];

        const defaultValue = values.find((value) => value.isDefault);
        if (!defaultValue) return null;
        if (defaultValue._id) return defaultValue._id;
        // insertMany keeps the order: the default's place among the new values.
        return inserted[values.filter((value) => !value._id).indexOf(defaultValue)]._id;
    } catch (err) {
        throw err;
    }
};

// PUT /api/masters/:id - the details and the full list of values, saved together.
const updateMaster = async ({ vendorId, userId, id, data, companyMasterData }) => {
    try {
        const { valuesAllowedPerMaster } = limitsOf(companyMasterData);
        if (!Number.isInteger(valuesAllowedPerMaster)) return limitNotSet();
        if (data.values.length > valuesAllowedPerMaster) return tooManyValues(valuesAllowedPerMaster);

        const current = await MasterValue.find({ vendorId, masterId: id, status: LIVE }).select('_id name status precedence').lean();
        const currentIds = new Set(current.map((value) => String(value._id)));
        if (data.values.some((value) => value._id && !currentIds.has(value._id))) {
            return common.returnResult(false, 409, 'This master was changed meanwhile. Please reload it and make your changes again.');
        }
        if (!data.isRoleProvided) {
            const used = await usedByRolesResult({ vendorId, id, action: 'untick "Role will be provided for this master"' });
            if (used) return used;
        }

        let master;
        try {
            master = await Master.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: { name: data.name, shortName: data.shortName, isRequired: data.isRequired, isMultiselectAllowed: data.isMultiselectAllowed, isRoleProvided: data.isRoleProvided } },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: MASTER_FIELDS }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err, data);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!master) return common.returnResult(false, 404, 'Master not found.');

        const defaultValueId = await saveValues({ vendorId, userId, id, values: data.values, current });
        if (String(defaultValueId) !== String(master.defaultValueId)) {
            await Master.updateOne({ _id: id, vendorId }, { $set: { defaultValueId } }, { auditUserId: userId });
            master.defaultValueId = defaultValueId;
        }

        const values = await MasterValue.find({ vendorId, masterId: id, status: LIVE }).select(VALUE_FIELDS).sort({ precedence: 1 }).lean();
        return common.returnResult(true, 200, 'Master saved.', { master: { ...master, values } });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/masters/:id/status
const setMasterStatus = async ({ vendorId, userId, id, isActive }) => {
    try {
        const result = await common.toggleActiveStatus(Master, id, userId, isActive, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Master not found.') : result;
        return common.returnResult(true, 200, isActive ? 'Master marked as active.' : 'Master marked as inactive.', {
            master: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/masters/:id - soft delete, with all its values.
const deleteMaster = async ({ vendorId, userId, id }) => {
    try {
        const used = await usedByRolesResult({ vendorId, id, action: 'delete it' });
        if (used) return used;
        const result = await common.softDelete(Master, id, userId, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Master not found.') : result;
        await MasterValue.updateMany(
            { vendorId, masterId: id, status: LIVE },
            { $set: { status: 'D', deletedBy: userId, deletedDate: new Date() } },
            { auditUserId: userId }
        );
        return common.returnResult(true, 200, 'Master deleted.');
    } catch (err) {
        throw err;
    }
};

const BULK_ACTIONS = {
    activate: (args) => setMasterStatus({ ...args, isActive: true }),
    deactivate: (args) => setMasterStatus({ ...args, isActive: false }),
    delete: deleteMaster
};

// POST /api/masters/bulk - each master on its own; meta.results says how each went.
const bulkUpdateMasters = async ({ vendorId, userId, action, ids }) => {
    try {
        const run = BULK_ACTIONS[action];
        return await common.runBulkOperation(ids, (id) => run({ vendorId, userId, id }));
    } catch (err) {
        throw err;
    }
};

// PATCH /api/masters/:id/move - swaps places with the master just above /
// below it in the whole list (across pages).
const moveMaster = async ({ vendorId, userId, id, direction }) => {
    try {
        return await common.swapPrecedence(Master, { vendorId }, id, direction, userId, 'master');
    } catch (err) {
        throw err;
    }
};

// ---- values (the values popup on the list) ----------------------------------

// A value that is made inactive or deleted can't stay the default.
const clearDefaultIf = async ({ vendorId, userId, id, valueId }) => {
    try {
        await Master.updateOne({ _id: id, vendorId, defaultValueId: valueId }, { $set: { defaultValueId: null } }, { auditUserId: userId });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/masters/:id/default - the value picked in advance on a new job
// order (an active value of this master), or null for none.
const setDefaultValue = async ({ vendorId, userId, id, valueId }) => {
    try {
        if (valueId !== null) {
            const value = await MasterValue.findOne({ _id: valueId, vendorId, masterId: id, status: LIVE }).select('status').lean();
            if (!value) return common.returnResult(false, 404, 'Value not found.');
            if (value.status !== 'A') return common.returnResult(false, 400, 'An inactive value cannot be the default. Mark it active first.');
        }
        const result = await Master.updateOne({ _id: id, vendorId, status: LIVE }, { $set: { defaultValueId: valueId } }, { auditUserId: userId });
        if (result.matchedCount === 0) return common.returnResult(false, 404, 'Master not found.');
        return common.returnResult(true, 200, valueId ? 'Default value set.' : 'Default value removed.', { defaultValueId: valueId });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/masters/:id/values/:valueId/status
const setValueStatus = async ({ vendorId, userId, id, valueId, isActive }) => {
    try {
        const result = await common.toggleActiveStatus(MasterValue, valueId, userId, isActive, vendorId, { masterId: id });
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Value not found.') : result;
        if (!isActive) await clearDefaultIf({ vendorId, userId, id, valueId });
        return common.returnResult(true, 200, isActive ? 'Value marked as active.' : 'Value marked as inactive.', {
            value: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/masters/:id/values/:valueId/move - swaps places with the value
// just above / below it in the same master.
const moveValue = async ({ vendorId, userId, id, valueId, direction }) => {
    try {
        return await common.swapPrecedence(MasterValue, { vendorId, masterId: id }, valueId, direction, userId, 'value');
    } catch (err) {
        throw err;
    }
};

// DELETE /api/masters/:id/values/:valueId - soft delete. The last value can't
// go: a master always has at least one.
const deleteValue = async ({ vendorId, userId, id, valueId }) => {
    try {
        const valuesLeft = await MasterValue.countDocuments({ vendorId, masterId: id, status: LIVE });
        if (valuesLeft <= 1) {
            return common.returnResult(false, 400, 'A master needs at least one value. Add another value first, or delete the whole master.');
        }
        const result = await common.softDelete(MasterValue, valueId, userId, vendorId, { masterId: id });
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Value not found.') : result;
        await clearDefaultIf({ vendorId, userId, id, valueId });
        await removeValuesFromRoles({ vendorId, userId, id, valueIds: [result.meta.document._id] });
        return common.returnResult(true, 200, 'Value deleted.');
    } catch (err) {
        throw err;
    }
};

// ---- job order -------------------------------------------------------------

// GET /api/masters/for-job-order - every active master with its active values,
// both in order, and the default value (only if it is still active). Masters
// without an active value are left out - there would be nothing to pick.
const getMastersForJobOrder = async ({ vendorId }) => {
    try {
        const masters = await Master.find({ vendorId, status: 'A' })
            .select('_id name shortName isRequired isMultiselectAllowed defaultValueId').sort({ precedence: 1 }).lean();
        const values = masters.length === 0 ? [] : await MasterValue.find({ vendorId, masterId: { $in: masters.map((m) => m._id) }, status: 'A' })
            .select('_id masterId name').sort({ precedence: 1 }).lean();

        const valuesByMaster = new Map();
        for (const { masterId, ...value } of values) {
            const key = String(masterId);
            if (!valuesByMaster.has(key)) valuesByMaster.set(key, []);
            valuesByMaster.get(key).push(value);
        }

        const result = [];
        for (const master of masters) {
            const masterValues = valuesByMaster.get(String(master._id));
            if (!masterValues) continue;
            const hasDefault = masterValues.some((value) => String(value._id) === String(master.defaultValueId));
            result.push({ ...master, defaultValueId: hasDefault ? master.defaultValueId : null, values: masterValues });
        }
        return common.returnResult(true, 200, 'Masters fetched successfully.', { masters: result });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getMastersForJobOrder,
    listMasters,
    getMaster,
    createMaster,
    updateMaster,
    setMasterStatus,
    deleteMaster,
    bulkUpdateMasters,
    moveMaster,
    setValueStatus,
    moveValue,
    setDefaultValue,
    deleteValue
};
