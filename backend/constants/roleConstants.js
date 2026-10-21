// Every vendor gets exactly one login: the owner account (created by
// seeds/seedUser.js). More users and their roles come with the RBAC feature,
// which adds its roles here.
const ROLES = {
    OWNER: 'owner'
};

module.exports = {
    ROLES,
    ROLE_VALUES: Object.values(ROLES)
};
