const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');
const RefreshToken = require('../models/RefreshToken');
const common = require('../utils/common');
const { todayString } = require('../utils/days');
const roleService = require('./roleService');
const { ROLES } = require('../constants/roleConstants');
const { LIVE_STATUSES } = require('../constants/masterConstants');
const { MODULES } = require('../constants/rbacConstants');

// The vendor's users (Users module): never the owner - every query is
// scoped by vendorId and role 'user'.
//
// A user gets Role Master roles (one, or several with
// CompanyMaster.isAssigningSeveralRolesAllowed) and, with
// CompanyMaster.isRoleAssignmentOnUserModuleAllowed, extra access of their
// own: single module options (e.g. Masters: create) and role-provided masters
// (whole or some values, view only - like a master role). Every role and
// every extra has its own dates: start empty = today, end empty = no end.
//
// Limit: CompanyMaster.numberOfUsersAllowed (active + inactive users; null =
// no limit).

const LIVE = { $in: LIVE_STATUSES };
const USERS = { role: ROLES.USER };
const USER_FIELDS = '_id name username email phone_no address assignedRoles extraModules extraMasters status createdAt updatedAt';
const LIST_FIELDS = '_id name username email phone_no assignedRoles extraModules extraMasters status createdAt';

const idOf = (value) => String(value);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


const settingsOf = (companyMasterData) => ({
    canGiveExtraAccess: companyMasterData?.isRoleAssignmentOnUserModuleAllowed === true,
    canGiveSeveralRoles: companyMasterData?.isAssigningSeveralRolesAllowed === true
});
const limitsOf = (companyMasterData) => ({ usersAllowed: companyMasterData?.numberOfUsersAllowed ?? null });

// { startDate, endDate } with today for an empty start, or null after
// pushing an error when the end is before the start.
const checkDates = (entry, field, label, errors) => {
    try {
        const startDate = entry.startDate || todayString();
        if (entry.endDate && entry.endDate < startDate) {
            errors.push({ field, message: `${label}: the end date is before the start date` });
            return null;
        }
        return { startDate, endDate: entry.endDate || null };
    } catch (err) {
        throw err;
    }
};

// What is saved of the roles and extra access, or field errors: roles,
// roles.<roleId>, extraModules.<module>.<permission>, extraMasters.<masterId>.
// Without extra access allowed, the user's extras are left as they are.
const checkAccess = async ({ vendorId, data, current, websiteMasterData, companyMasterData }) => {
    try {
        const errors = [];
        const doc = {};
        const settings = settingsOf(companyMasterData);

        if (!settings.canGiveSeveralRoles && data.roles.length > 1) {
            errors.push({ field: 'roles', message: 'Only one role can be given to a user' });
        }
        const [roles, roleMasters] = await Promise.all([
            data.roles.length === 0 ? [] : Role.find({ vendorId, status: LIVE, _id: { $in: data.roles.map((entry) => entry.roleId) } }).select('_id name status').lean(),
            settings.canGiveExtraAccess && data.extraMasters.length > 0 ? roleService.roleMastersOf(vendorId) : []
        ]);
        const roleById = new Map(roles.map((role) => [idOf(role._id), role]));
        const hadRole = new Set((current?.assignedRoles || []).map((entry) => idOf(entry.roleId)));
        doc.assignedRoles = [];
        for (const entry of data.roles) {
            const field = `roles.${entry.roleId}`;
            const role = roleById.get(entry.roleId);
            if (!role) {
                errors.push({ field, message: 'This role no longer exists. Please remove it.' });
                continue;
            }
            // An inactive role already given stays; it can't be newly given.
            if (role.status !== 'A' && !hadRole.has(entry.roleId)) {
                errors.push({ field, message: `The role "${role.name}" is inactive` });
                continue;
            }
            const range = checkDates(entry, field, role.name, errors);
            if (range) doc.assignedRoles.push({ roleId: role._id, ...range });
        }

        if (!settings.canGiveExtraAccess) return { errors, doc };

        const available = new Map(roleService.availableModulesOf(websiteMasterData, companyMasterData).map((module) => [module.key, module]));
        doc.extraModules = [];
        for (const entry of data.extraModules) {
            const field = `extraModules.${entry.module}.${entry.permission}`;
            const module = available.get(entry.module);
            if (!module) {
                errors.push({ field, message: `${MODULES[entry.module].label} is not available for your account` });
                continue;
            }
            if (!module.permissions.includes(entry.permission)) {
                errors.push({ field, message: `${module.label} has only ${module.permissions.join(', ')}` });
                continue;
            }
            const range = checkDates(entry, field, module.label, errors);
            if (range) doc.extraModules.push({ module: entry.module, permission: entry.permission, ...range });
        }

        const known = new Map(roleMasters.map((master) => [idOf(master._id), master]));
        doc.extraMasters = [];
        for (const entry of data.extraMasters) {
            const field = `extraMasters.${entry.masterId}`;
            const master = known.get(entry.masterId);
            if (!master) {
                errors.push({ field, message: 'This master is no longer set for roles. Please remove it.' });
                continue;
            }
            const valueById = new Map(master.values.map((value) => [idOf(value._id), value]));
            if (!entry.isWholeMaster && entry.valueIds.length === 0) {
                errors.push({ field, message: `Pick at least one value of ${master.name}, or tick "Whole master"` });
                continue;
            }
            if (!entry.isWholeMaster && entry.valueIds.some((valueId) => !valueById.has(valueId))) {
                errors.push({ field, message: `A value picked in ${master.name} is no longer available. Please pick again.` });
                continue;
            }
            const range = checkDates(entry, field, master.name, errors);
            if (!range) continue;
            doc.extraMasters.push({
                masterId: master._id,
                isWholeMaster: entry.isWholeMaster,
                valueIds: entry.isWholeMaster ? [] : entry.valueIds.map((valueId) => valueById.get(valueId)._id),
                ...range
            });
        }
        return { errors, doc };
    } catch (err) {
        throw err;
    }
};

const invalid = (errors) => common.returnResult(false, 400, errors[0].message, { errors });

// The username, email or phone of another user (or the owner) -> 409 on that field.
const DUPLICATE_FIELDS = {
    username: ['username', 'This login username is already used.'],
    email: ['email', 'This email is already used by another user.'],
    phone_no: ['phone', 'This phone number is already used by another user.']
};
const duplicateResult = (err) => {
    try {
        if (err?.code !== 11000) return null;
        const key = Object.keys(err.keyPattern || {}).find((name) => DUPLICATE_FIELDS[name]);
        if (!key) return null;
        const [field, message] = DUPLICATE_FIELDS[key];
        return common.returnResult(false, 409, message, { errors: [{ field, message }] });
    } catch (error) {
        throw error;
    }
};

const hashPassword = (password) => bcrypt.hash(password, Number(process.env.SALT_ROUNDS) || 10);

const detailsOf = (data) => ({
    name: data.name,
    username: data.username,
    email: data.email,
    phone_no: data.phone,
    address: data.address
});

// ---- the form -------------------------------------------------------------------

// GET /api/users/form-data - what a user can be given.
const getFormData = async ({ vendorId, websiteMasterData, companyMasterData }) => {
    try {
        const settings = settingsOf(companyMasterData);
        const [roles, masters] = await Promise.all([
            // Inactive ones too, to name a role a user already has.
            Role.find({ vendorId, status: LIVE }).select('_id name type status').sort({ name: 1 }).collation({ locale: 'en', strength: 2 }).lean(),
            settings.canGiveExtraAccess ? roleService.roleMastersOf(vendorId) : []
        ]);
        return common.returnResult(true, 200, 'User form fetched successfully.', {
            roles,
            modules: settings.canGiveExtraAccess ? roleService.availableModulesOf(websiteMasterData, companyMasterData) : [],
            masters,
            settings,
            limits: limitsOf(companyMasterData),
            today: todayString()
        });
    } catch (err) {
        throw err;
    }
};

// ---- users ----------------------------------------------------------------------

// GET /api/users - newest first; search name, username, email or phone;
// filter by status and role.
const listUsers = async ({ vendorId, search, status, roleId, page, limit, companyMasterData }) => {
    try {
        const filter = { vendorId, ...USERS, status: status || LIVE };
        if (roleId) filter['assignedRoles.roleId'] = roleId;
        if (search) {
            const pattern = new RegExp(escapeRegex(search), 'i');
            filter.$or = [{ name: pattern }, { username: pattern }, { email: pattern }, { phone_no: pattern }];
        }
        const isUnfiltered = !search && !status && !roleId;

        const [total, users, usersUsed] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter).select(LIST_FIELDS).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            isUnfiltered ? null : User.countDocuments({ vendorId, ...USERS, status: LIVE })
        ]);
        const roleIds = [...new Set(users.flatMap((user) => user.assignedRoles.map((entry) => idOf(entry.roleId))))];
        const roles = roleIds.length === 0 ? [] : await Role.find({ vendorId, _id: { $in: roleIds }, status: LIVE }).select('_id name status').lean();
        const roleById = new Map(roles.map((role) => [idOf(role._id), role]));

        return common.returnResult(true, 200, 'Users fetched successfully.', {
            users: users.map(({ extraModules, extraMasters, phone_no, ...user }) => ({
                ...user,
                phone: phone_no,
                assignedRoles: user.assignedRoles.map((entry) => ({
                    ...entry,
                    roleName: roleById.get(idOf(entry.roleId))?.name || null,
                    roleStatus: roleById.get(idOf(entry.roleId))?.status || null
                })),
                extraAccessCount: extraModules.length + extraMasters.length
            })),
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
            limits: { ...limitsOf(companyMasterData), usersUsed: isUnfiltered ? total : usersUsed },
            today: todayString()
        });
    } catch (err) {
        throw err;
    }
};

// GET /api/users/:id - never the password.
const getUser = async ({ vendorId, id }) => {
    try {
        const user = await User.findOne({ _id: id, vendorId, ...USERS, status: LIVE }).select(USER_FIELDS).lean();
        if (!user) return common.returnResult(false, 404, 'User not found.');
        const { phone_no, ...rest } = user;
        return common.returnResult(true, 200, 'User fetched successfully.', { user: { ...rest, phone: phone_no } });
    } catch (err) {
        throw err;
    }
};

// POST /api/users
const createUser = async ({ vendorId, data, websiteMasterData, companyMasterData }) => {
    try {
        const { usersAllowed } = limitsOf(companyMasterData);
        if (usersAllowed !== null && await User.countDocuments({ vendorId, ...USERS, status: LIVE }) >= usersAllowed) {
            return common.returnResult(false, 403, `You can have at most ${usersAllowed} users. Delete one you no longer need to add another.`);
        }

        const { errors, doc } = await checkAccess({ vendorId, data, current: null, websiteMasterData, companyMasterData });
        if (errors.length > 0) return invalid(errors);

        let user;
        try {
            user = await User.create({
                vendorId,
                ...detailsOf(data),
                password: await hashPassword(data.password),
                authProvider: 'local',
                role: ROLES.USER,
                ...doc
            });
        } catch (err) {
            const duplicate = duplicateResult(err);
            if (duplicate) return duplicate;
            throw err;
        }
        return common.returnResult(true, 201, `User "${user.name}" created.`, { user: { _id: user._id, name: user.name } });
    } catch (err) {
        throw err;
    }
};

// PUT /api/users/:id - details, roles and extra access; a new password
// (optional) also logs the user out everywhere.
const updateUser = async ({ vendorId, userId, id, data, websiteMasterData, companyMasterData }) => {
    try {
        const current = await User.findOne({ _id: id, vendorId, ...USERS, status: LIVE }).select('assignedRoles').lean();
        if (!current) return common.returnResult(false, 404, 'User not found.');

        const { errors, doc } = await checkAccess({ vendorId, data, current, websiteMasterData, companyMasterData });
        if (errors.length > 0) return invalid(errors);

        const set = { ...detailsOf(data), ...doc };
        if (data.password) set.password = await hashPassword(data.password);
        let user;
        try {
            user = await User.findOneAndUpdate(
                { _id: id, vendorId, ...USERS, status: LIVE },
                { $set: set },
                { returnDocument: 'after', runValidators: true, auditUserId: userId, projection: { _id: 1, name: 1 } }
            ).lean();
        } catch (err) {
            const duplicate = duplicateResult(err);
            if (duplicate) return duplicate;
            throw err;
        }
        if (!user) return common.returnResult(false, 404, 'User not found.');
        if (data.password) await RefreshToken.deleteMany({ userId: user._id });
        return common.returnResult(true, 200, `User "${user.name}" saved.`, { user });
    } catch (err) {
        throw err;
    }
};

// PATCH /api/users/:id/status - an inactive user is refused on every request
// (middlewares/authenticate.js).
const setUserStatus = async ({ vendorId, userId, id, isActive }) => {
    try {
        const result = await common.toggleActiveStatus(User, id, userId, isActive, vendorId, USERS);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'User not found.') : result;
        return common.returnResult(true, 200, isActive ? 'User marked as active.' : 'User marked as inactive.', {
            user: { _id: result.meta.document._id, status: result.meta.document.status }
        });
    } catch (err) {
        throw err;
    }
};

// DELETE /api/users/:id - soft delete; their username, email and phone can be
// used again. Their sessions end.
const deleteUser = async ({ vendorId, userId, id }) => {
    try {
        const result = await common.softDelete(User, id, userId, vendorId, USERS);
        if (!result.isSuccess) return result.statusCode === 404 ? common.returnResult(false, 404, 'User not found.') : result;
        await RefreshToken.deleteMany({ userId: result.meta.document._id });
        return common.returnResult(true, 200, 'User deleted.');
    } catch (err) {
        throw err;
    }
};

const BULK_ACTIONS = {
    activate: (args) => setUserStatus({ ...args, isActive: true }),
    deactivate: (args) => setUserStatus({ ...args, isActive: false }),
    delete: deleteUser
};

// POST /api/users/bulk - each user on its own; meta.results says how each went.
const bulkUpdateUsers = async ({ vendorId, userId, action, ids }) => {
    try {
        const run = BULK_ACTIONS[action];
        return await common.runBulkOperation(ids, (id) => run({ vendorId, userId, id }));
    } catch (err) {
        throw err;
    }
};

module.exports = {
    getFormData,
    listUsers,
    getUser,
    createUser,
    updateUser,
    setUserStatus,
    deleteUser,
    bulkUpdateUsers
};
