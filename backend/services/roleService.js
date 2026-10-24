const Role = require('../models/Role');
const User = require('../models/User');
const Master = require('../models/Master');
const MasterValue = require('../models/MasterValue');
const common = require('../utils/common');
const featureAccessService = require('./featureAccessService');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { ROLE_TYPES, MODULES, MODULE_KEYS, withImpliedPermissions } = require('../constants/rbacConstants');
const { ROLES } = require('../constants/roleConstants');

// The vendor's roles (Role Master). Every function is scoped by vendorId.
//
// Module role: per module, the permissions given (view / details / create /
// edit / delete, and "role assignment" for Users). Only modules switched on
// for the vendor can be given; giving anything also gives view, and edit
// also gives details.
// Master role: masters marked "Role will be provided for this master", each
// as the whole master or some of its values.
//
// Limit: CompanyMaster.numberOfRoleCreationAllowed (active + inactive roles;
// null = no limit).

const LIVE = { $in: LIVE_STATUSES };
const ROLE_FIELDS = '_id name type modules masters status createdAt updatedAt';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idOf = (value) => String(value);

const limitsOf = (companyMasterData) => ({ rolesAllowed: companyMasterData?.numberOfRoleCreationAllowed ?? null });

// The modules this vendor can give in a role, in form order: those whose
// feature is on (Job Orders and Company Settings always).
const availableModulesOf = (websiteMasterData, companyMasterData) => {
    try {
        const access = featureAccessService.getFeatureAccess(websiteMasterData, companyMasterData).meta.featureAccess;
        return MODULE_KEYS
            .filter((key) => !MODULES[key].featureFlag || access[MODULES[key].featureFlag] === true)
            .map((key) => ({ key, label: MODULES[key].label, permissions: MODULES[key].permissions }));
    } catch (err) {
        throw err;
    }
};

// The masters a master role can use (role-provided, not deleted) with their
// values (not deleted), both in order.
const roleMastersOf = async (vendorId) => {
    try {
        const masters = await Master.find({ vendorId, status: LIVE, isRoleProvided: true })
            .select('_id name status').sort({ precedence: 1 }).lean();
        if (masters.length === 0) return [];
        const values = await MasterValue.find({ vendorId, masterId: { $in: masters.map((m) => m._id) }, status: LIVE })
            .select('_id masterId name status').sort({ precedence: 1 }).lean();
        const byMaster = new Map(masters.map((master) => [idOf(master._id), []]));
        for (const { masterId, ...value } of values) byMaster.get(idOf(masterId)).push(value);
        return masters.map((master) => ({ ...master, values: byMaster.get(idOf(master._id)) }));
    } catch (err) {
        throw err;
    }
};

// What is saved, or field errors: modules.<key>, masters.<masterId>, modules, masters.
const checkRole = ({ type, data, availableModules, roleMasters }) => {
    try {
        const errors = [];
        if (type === ROLE_TYPES.MODULE) {
            if (data.modules.length === 0) errors.push({ field: 'modules', message: 'Add at least one module' });
            const available = new Map(availableModules.map((module) => [module.key, module]));
            const modules = [];
            for (const entry of data.modules) {
                const field = `modules.${entry.module}`;
                const module = available.get(entry.module);
                if (!module) {
                    errors.push({ field, message: `${MODULES[entry.module].label} is not available for your account` });
                    continue;
                }
                if (entry.permissions.some((permission) => !module.permissions.includes(permission))) {
                    errors.push({ field, message: `${module.label} has only ${module.permissions.join(', ')}` });
                    continue;
                }
                if (entry.permissions.length === 0) {
                    errors.push({ field, message: 'Tick at least one option' });
                    continue;
                }
                // With what comes with each (View, Details for Edit); kept in the module's own order.
                const given = new Set(entry.permissions.flatMap(withImpliedPermissions));
                modules.push({ module: entry.module, permissions: module.permissions.filter((permission) => given.has(permission)) });
            }
            return { errors, doc: { modules, masters: [] } };
        }

        if (data.masters.length === 0) errors.push({ field: 'masters', message: 'Add at least one master' });
        const known = new Map(roleMasters.map((master) => [idOf(master._id), master]));
        const masters = [];
        for (const entry of data.masters) {
            const field = `masters.${entry.masterId}`;
            const master = known.get(entry.masterId);
            if (!master) {
                errors.push({ field, message: 'This master is no longer set for roles. Please remove it.' });
                continue;
            }
            if (entry.isWholeMaster) {
                masters.push({ masterId: master._id, isWholeMaster: true, valueIds: [] });
                continue;
            }
            const valueById = new Map(master.values.map((value) => [idOf(value._id), value]));
            if (entry.valueIds.length === 0) {
                errors.push({ field, message: `Pick at least one value of ${master.name}, or tick "Whole master"` });
                continue;
            }
            if (entry.valueIds.some((valueId) => !valueById.has(valueId))) {
                errors.push({ field, message: `A value picked in ${master.name} is no longer available. Please pick again.` });
                continue;
            }
            masters.push({ masterId: master._id, isWholeMaster: false, valueIds: entry.valueIds.map((valueId) => valueById.get(valueId)._id) });
        }
        return { errors, doc: { modules: [], masters } };
    } catch (err) {
        throw err;
    }
};

const invalid = (errors) => common.returnResult(false, 400, errors[0].message, { errors });

const duplicateResult = (err, name) => {
    try {
        if (err?.code !== 11000) return null;
        const message = `A role named "${name}" already exists.`;
        return common.returnResult(false, 409, message, { errors: [{ field: 'name', message }] });
    } catch (error) {
        throw error;
    }
};

// Names for the list: each master role's masters and values.
const describeMasters = async (vendorId, roles) => {
    try {
        const masterIds = new Set();
        const valueIds = new Set();
        for (const role of roles) {
            for (const entry of role.masters) {
                masterIds.add(idOf(entry.masterId));
                entry.valueIds.forEach((valueId) => valueIds.add(idOf(valueId)));
            }
        }
        if (masterIds.size === 0) return new Map();
        const [masters, values] = await Promise.all([
            Master.find({ vendorId, _id: { $in: [...masterIds] } }).select('_id name').lean(),
            valueIds.size === 0 ? [] : MasterValue.find({ vendorId, _id: { $in: [...valueIds] }, status: LIVE }).select('_id name').lean()
        ]);
        return new Map([...masters, ...values].map((doc) => [idOf(doc._id), doc.name]));
    } catch (err) {
        throw err;
    }
};

// ---- the form -----------------------------------------------------------------

// GET /api/roles/form-data - what a role can be made of.
const getFormData = async ({ vendorId, websiteMasterData, companyMasterData }) => {
    try {
        return common.returnResult(true, 200, 'Role form fetched successfully.', {
            modules: availableModulesOf(websiteMasterData, companyMasterData),
            masters: await roleMastersOf(vendorId),
            limits: limitsOf(companyMasterData)
        });
    } catch (err) {
        throw err;
    }
};

// ---- roles ----------------------------------------------------------------------

// GET /api/roles - newest first; search by name; filter by status and type.
const listRoles = async ({ vendorId, search, status, type, page, limit, companyMasterData }) => {
    try {
        const filter = { vendorId, status: status || LIVE };
        if (type) filter.type = type;
        if (search) filter.name = new RegExp(escapeRegex(search), 'i');
        const isUnfiltered = !search && !status && !type;

        const [total, roles, rolesUsed] = await Promise.all([
            Role.countDocuments(filter),
            Role.find(filter).select(ROLE_FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            isUnfiltered ? null : Role.countDocuments({ vendorId, status: LIVE })
        ]);
        const names = await describeMasters(vendorId, roles);

        return common.returnResult(true, 200, 'Roles fetched successfully.', {
            roles: roles.map((role) => ({
                ...role,
                masters: role.masters.map((entry) => ({
                    ...entry,
                    masterName: names.get(idOf(entry.masterId)) || null,
                    valueNames: entry.valueIds.map((valueId) => names.get(idOf(valueId))).filter(Boolean)
                }))
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            limits: { ...limitsOf(companyMasterData), rolesUsed: isUnfiltered ? total : rolesUsed }
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/roles/:id
const getRole = async ({ vendorId, id, companyMasterData }) => {
    try {
        const role = await Role.findOne({ _id: id, vendorId, status: LIVE }).select(ROLE_FIELDS).lean();
        if (!role) return common.returnResult(false, 404, 'Role not found.');
        return common.returnResult(true, 200, 'Role fetched successfully.', { role, limits: limitsOf(companyMasterData) });
    } catch (err) {
        throw err;
    }
};

// POST /api/roles (also saves a copy)
const createRole = async ({ vendorId, userId, data, websiteMasterData, companyMasterData }) => {
    try {
        const { rolesAllowed } = limitsOf(companyMasterData);
        const [rolesUsed, roleMasters] = await Promise.all([
            rolesAllowed === null ? 0 : Role.countDocuments({ vendorId, status: LIVE }),
            data.type === ROLE_TYPES.MASTER ? roleMastersOf(vendorId) : []
        ]);
        if (rolesAllowed !== null && rolesUsed >= rolesAllowed) {
            return common.returnResult(false, 403, `You can have at most ${rolesAllowed} roles. Delete one you no longer need to add another.`);
        }

        const availableModules = availableModulesOf(websiteMasterData, companyMasterData);
        const { errors, doc } = checkRole({ type: data.type, data, availableModules, roleMasters });
        if (errors.length > 0) return invalid(errors);

        let role;
        try {
            role = await Role.create({ vendorId, name: data.name, type: data.type, ...doc });
        } catch (err) {
            const duplicate = duplicateResult(err, data.name);
            if (duplicate) return duplicate;
            throw err;
        }
        return common.returnResult(true, 201, `Role "${role.name}" created.`, { role: { _id: role._id, name: role.name } });
    } catch (err) {
        throw err;
    }
};

// PUT /api/roles/:id - name and what it covers (its type never changes).
const updateRole = async ({ vendorId, userId, id, data, websiteMasterData, companyMasterData }) => {
    try {
        const current = await Role.findOne({ _id: id, vendorId, status: LIVE }).select('type').lean();
        if (!current) return common.returnResult(false, 404, 'Role not found.');

        const roleMasters = current.type === ROLE_TYPES.MASTER ? await roleMastersOf(vendorId) : [];
        const availableModules = availableModulesOf(websiteMasterData, companyMasterData);
        const { errors, doc } = checkRole({ type: current.type, data, availableModules, roleMasters });
        if (errors.length > 0) return invalid(errors);

        let role;
        try {
            role = await Role.findOneAndUpdate(
                { _id: id, vendorId, status: LIVE },
                { $set: { name: data.name, ...doc } },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: { _id: 1, name: 1 } }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err, data.name);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!role) return common.returnResult(false, 404, 'Role not found.');
        return common.returnResult(true, 200, `Role "${role.name}" saved.`, { role });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/roles/:id/status
const setRoleStatus = async ({ vendorId, userId, id, isActive }) => {
    try {
        const result = await common.toggleActiveStatus(Role, id, userId, isActive, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Role not found.') : result;
        return common.returnResult(true, 200, isActive ? 'Role marked as active.' : 'Role marked as inactive.', {
            role: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/roles/:id - soft delete; its name can be used again. A role
// given to users can't be deleted (409 naming them).
const deleteRole = async ({ vendorId, userId, id }) => {
    try {
        const users = await User.find({ vendorId, role: ROLES.USER, status: LIVE, 'assignedRoles.roleId': id }).select('name').limit(4).lean();
        if (users.length > 0) {
            const names = users.slice(0, 3).map((user) => `"${user.name}"`).join(', ') + (users.length > 3 ? ' and more' : '');
            return common.returnResult(false, 409, `This role is given to the user${users.length > 1 ? 's' : ''} ${names}. Remove it from ${users.length > 1 ? 'them' : 'that user'} first, then delete it.`);
        }
        const result = await common.softDelete(Role, id, userId, vendorId);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'Role not found.') : result;
        return common.returnResult(true, 200, 'Role deleted.');
    } catch (err) {
        throw err;
    }
};

const BULK_ACTIONS = {
    activate: (args) => setRoleStatus({ ...args, isActive: true }),
    deactivate: (args) => setRoleStatus({ ...args, isActive: false }),
    delete: deleteRole
};

// POST /api/roles/bulk - each role on its own; meta.results says how each went.
const bulkUpdateRoles = async ({ vendorId, userId, action, ids }) => {
    try {
        const run = BULK_ACTIONS[action];
        return await common.runBulkOperation(ids, (id) => run({ vendorId, userId, id }));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    // Shared with services/userService.js (extra access of a user).
    availableModulesOf,
    roleMastersOf,
    getFormData,
    listRoles,
    getRole,
    createRole,
    updateRole,
    setRoleStatus,
    deleteRole,
    bulkUpdateRoles
};
