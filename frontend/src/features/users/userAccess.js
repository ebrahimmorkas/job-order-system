import { withImplied } from '../roles/roleTypes';

// What a user's roles give - worked out like the backend (accessService):
// only active roles count.

/** The given roles (form-data roles) of the picked ones [{ roleId }]. */
export const givenRolesOf = (picked, allRoles) => {
  const roleById = new Map(allRoles.map((role) => [role._id, role]));
  return picked.map(({ roleId }) => roleById.get(roleId)).filter((role) => role?.status === 'A');
};

/** Module roles -> Map(module, Set of permissions, with what comes with each). */
export const roleModulesOf = (roles) => {
  const given = new Map();
  for (const role of roles) {
    if (role.type !== 'module') continue;
    for (const { module, permissions } of role.modules || []) {
      const set = given.get(module) || new Set();
      for (const permission of permissions) withImplied(permission).forEach((p) => set.add(p));
      given.set(module, set);
    }
  }
  return given;
};

/** Master roles -> Map(masterId, { isWholeMaster, valueIds: Set }). */
export const roleMastersOf = (roles) => {
  const given = new Map();
  for (const role of roles) {
    if (role.type !== 'master') continue;
    for (const { masterId, isWholeMaster, valueIds } of role.masters || []) {
      const entry = given.get(masterId) || { isWholeMaster: false, valueIds: new Set() };
      entry.isWholeMaster = entry.isWholeMaster || isWholeMaster;
      valueIds.forEach((valueId) => entry.valueIds.add(valueId));
      given.set(masterId, entry);
    }
  }
  return given;
};
