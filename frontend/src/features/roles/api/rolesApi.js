import { apiRequest } from '../../../utils/apiClient';

const BASE = '/roles';

/**
 * What a role can be made of.
 * @returns {Promise<{ modules: [{ key, label, permissions }], masters: [{ _id, name, status, values: [{ _id, name, status }] }], limits: { rolesAllowed } }>}
 */
export const getFormData = () => apiRequest(`${BASE}/form-data`);

/**
 * @param {{ search?: string, status?: 'A'|'I', type?: 'module'|'master', page?: number, limit?: number }} params
 * @returns {Promise<{ roles: Array, pagination: Object, limits: { rolesAllowed, rolesUsed } }>}
 *   Each master entry of a role also carries masterName and valueNames.
 */
export const listRoles = ({ search, status, type, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (type) query.set('type', type);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ role: Object, limits: Object }>} */
export const getRole = (id) => apiRequest(`${BASE}/${id}`);

/**
 * data: { name, type: 'module'|'master',
 *   modules?: [{ module, permissions }] (module role),
 *   masters?: [{ masterId, isWholeMaster, valueIds }] (master role) }
 */
export const createRole = (data) => apiRequest(BASE, { method: 'POST', body: data });

/** Same data as createRole without the type - it can't change. */
export const updateRole = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

export const setRoleStatus = (id, isActive) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { isActive } });

export const deleteRole = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** action: 'activate' | 'deactivate' | 'delete' -> { results, successCount, failureCount } */
export const bulkUpdateRoles = (action, ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action, ids } });
