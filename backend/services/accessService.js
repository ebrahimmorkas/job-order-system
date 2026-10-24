const User = require('../models/User');
const Role = require('../models/Role');
const common = require('../utils/common');
const roleService = require('./roleService');
const { todayString, coversDay } = require('../utils/days');
const { ROLES } = require('../constants/roleConstants');
const { ROLE_TYPES, withImpliedPermissions, withoutPermission } = require('../constants/rbacConstants');
const { FEATURE_FLAGS } = require('../constants/featureConstants');

// What a logged-in person may do. The owner may do everything. A user gets
// the modules and permissions of their active roles that cover today, plus
// their own extra access (only while CompanyMaster.isRoleAssignmentOnUserModuleAllowed
// is on) - and nothing at all while RBAC is off. What the owner took away
// from this user (revokedModules / revokedMasters) is taken out of what the
// roles give; extras are added after. Any permission of a module also gives
// View, and Edit gives Details. Modules whose feature is off are left out.
//
// hasWork: a master role or extra master access today - the "My work" page.

const NO_ACCESS = { isOwner: false, modules: {}, hasWork: false };

/**
 * A user's role masters less what was taken away from them: a whole master
 * goes; taken values go from a role's values, or are kept as exceptValueIds
 * of a whole master.
 * @returns {Array<{ masterId, isWholeMaster, valueIds, exceptValueIds }>}
 */
const withoutRevokedMasters = (entries, revokedMasters = []) => {
    try {
        if (revokedMasters.length === 0) return entries;
        const revokedById = new Map(revokedMasters.map((entry) => [String(entry.masterId), entry]));
        const left = [];
        for (const entry of entries) {
            const revoked = revokedById.get(String(entry.masterId));
            if (!revoked) { left.push(entry); continue; }
            if (revoked.isWholeMaster) continue;
            const taken = new Set(revoked.valueIds.map(String));
            if (entry.isWholeMaster) { left.push({ ...entry, exceptValueIds: [...taken] }); continue; }
            const valueIds = entry.valueIds.filter((valueId) => !taken.has(String(valueId)));
            if (valueIds.length > 0) left.push({ ...entry, valueIds });
        }
        return left;
    } catch (err) {
        throw err;
    }
};

/** RBAC is on only when it is on in WebsiteMaster AND in CompanyMaster. */
const isRbacOn = (websiteMasterData, companyMasterData) =>
    websiteMasterData?.[FEATURE_FLAGS.RBAC] === true && companyMasterData?.[FEATURE_FLAGS.RBAC] === true;

/**
 * @param {{ vendorId, user: { _id, role }, websiteMasterData, companyMasterData }} params
 * @returns {Promise<{ isOwner: boolean, modules: Object<string, string[]>, hasWork: boolean }>}
 */
const accessOf = async ({ vendorId, user, websiteMasterData, companyMasterData }) => {
    try {
        if (user.role === ROLES.OWNER) return { isOwner: true, modules: {}, hasWork: false };
        if (!isRbacOn(websiteMasterData, companyMasterData)) return NO_ACCESS;

        const own = await User.findOne({ _id: user._id, vendorId }).select('assignedRoles extraModules extraMasters revokedModules revokedMasters').lean();
        if (!own) return NO_ACCESS;
        const today = todayString();
        const roleIds = own.assignedRoles.filter((entry) => coversDay(entry, today)).map((entry) => entry.roleId);
        const roles = roleIds.length === 0 ? [] : await Role.find({ vendorId, _id: { $in: roleIds }, status: 'A' }).select('type modules masters').lean();
        const canUseExtras = companyMasterData?.isRoleAssignmentOnUserModuleAllowed === true;

        const granted = new Map();
        const grant = (module, permission) => {
            if (!granted.has(module)) granted.set(module, new Set());
            for (const given of withImpliedPermissions(permission)) granted.get(module).add(given);
        };
        let hasWork = false;
        for (const role of roles) {
            if (role.type === ROLE_TYPES.MODULE) {
                for (const entry of role.modules) for (const permission of entry.permissions) grant(entry.module, permission);
            } else if (withoutRevokedMasters(role.masters, own.revokedMasters).length > 0) {
                hasWork = true;
            }
        }
        for (const revoked of own.revokedModules || []) {
            const permissions = granted.get(revoked.module);
            if (!permissions) continue;
            const left = withoutPermission(permissions, revoked.permission);
            // No View left = no module at all.
            if (left.length === 0) granted.delete(revoked.module);
            else granted.set(revoked.module, new Set(left));
        }
        if (canUseExtras) {
            for (const extra of own.extraModules) if (coversDay(extra, today)) grant(extra.module, extra.permission);
            if (own.extraMasters.some((extra) => coversDay(extra, today))) hasWork = true;
        }

        const modules = {};
        for (const module of roleService.availableModulesOf(websiteMasterData, companyMasterData)) {
            const permissions = granted.get(module.key);
            if (permissions) modules[module.key] = module.permissions.filter((permission) => permissions.has(permission));
        }
        return { isOwner: false, modules, hasWork };
    } catch (err) {
        throw err;
    }
};

/** Whether access allows permission (or any of permissions) in module. */
const can = (access, module, permissions) => {
    try {
        if (access.isOwner) return true;
        const own = access.modules[module] || [];
        return [].concat(permissions).some((permission) => own.includes(permission));
    } catch (err) {
        throw err;
    }
};

// GET /api/access - what the logged-in person may do (the menu and buttons),
// and their own id (e.g. no Delete on your own row in Users).
const getMyAccess = async (params) => {
    try {
        return common.returnResult(true, 200, 'Access fetched successfully.', { access: { ...await accessOf(params), userId: String(params.user._id) } });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    isRbacOn,
    withoutRevokedMasters,
    accessOf,
    can,
    getMyAccess
};
