const User = require('../models/User');
const Role = require('../models/Role');
const { todayString, coversDay } = require('../utils/days');
const { ROLES } = require('../constants/roleConstants');
const { ROLE_TYPES } = require('../constants/rbacConstants');
const { isRbacOn } = require('./accessService');

// Who can be given the work of a master value on a job order: active users
// who have that value today - through an active master role (the value
// itself, or "Whole master"), or through extra access of their own (only
// while CompanyMaster.isRoleAssignmentOnUserModuleAllowed is on). Only
// masters with "Role will be provided" ticked, and only while RBAC is on.
// Users with module roles only (e.g. Company Settings) never show.

/**
 * @param {Object} params
 * @param {Array} params.masters - The job order form's masters ({ _id, isRoleProvided, values: [{ _id }] })
 * @returns {Promise<{ workers: Array<{ _id, name, username }>, byValue: Map<string, Set<string>> }>}
 *   byValue: valueId -> the ids of the users who have it
 */
const workersOf = async ({ vendorId, masters, websiteMasterData, companyMasterData }) => {
    try {
        const byValue = new Map();
        const roleMasters = isRbacOn(websiteMasterData, companyMasterData) ? masters.filter((master) => master.isRoleProvided) : [];
        if (roleMasters.length === 0) return { workers: [], byValue };

        // masterId -> its value ids (the live ones on the form).
        const valuesOfMaster = new Map(roleMasters.map((master) => [String(master._id), master.values.map((value) => String(value._id))]));
        const masterIds = roleMasters.map((master) => master._id);
        const roles = await Role.find({ vendorId, status: 'A', type: ROLE_TYPES.MASTER, 'masters.masterId': { $in: masterIds } })
            .select('_id masters').lean();
        const canUseExtras = companyMasterData?.isRoleAssignmentOnUserModuleAllowed === true;
        const or = [];
        if (roles.length > 0) or.push({ 'assignedRoles.roleId': { $in: roles.map((role) => role._id) } });
        if (canUseExtras) or.push({ 'extraMasters.masterId': { $in: masterIds } });
        if (or.length === 0) return { workers: [], byValue };

        const users = await User.find({ vendorId, role: ROLES.USER, status: 'A', $or: or })
            .select('_id name username assignedRoles extraMasters').sort({ name: 1 }).lean();

        const roleById = new Map(roles.map((role) => [String(role._id), role]));
        const today = todayString();
        const workers = [];
        for (const user of users) {
            const userId = String(user._id);
            const entries = [];
            for (const assigned of user.assignedRoles) {
                const role = roleById.get(String(assigned.roleId));
                if (role && coversDay(assigned, today)) entries.push(...role.masters);
            }
            if (canUseExtras) entries.push(...user.extraMasters.filter((extra) => coversDay(extra, today)));

            let hasAny = false;
            for (const entry of entries) {
                const values = valuesOfMaster.get(String(entry.masterId));
                if (!values) continue;
                const own = entry.isWholeMaster ? values : entry.valueIds.map(String).filter((valueId) => values.includes(valueId));
                for (const valueId of own) {
                    if (!byValue.has(valueId)) byValue.set(valueId, new Set());
                    byValue.get(valueId).add(userId);
                    hasAny = true;
                }
            }
            if (hasAny) workers.push({ _id: user._id, name: user.name, username: user.username });
        }
        return { workers, byValue };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    workersOf
};
