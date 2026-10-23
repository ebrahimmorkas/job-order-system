// Every vendor gets exactly one login: the owner account (created by
// seeds/seedUser.js). With the RBAC feature the owner adds users (Users
// module); what each one may do comes from Role Master roles.
const ROLES = {
    OWNER: 'owner',
    USER: 'user'
};

module.exports = {
    ROLES,
    ROLE_VALUES: Object.values(ROLES)
};
