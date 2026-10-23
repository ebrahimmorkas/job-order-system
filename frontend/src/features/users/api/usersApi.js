import { apiRequest } from '../../../utils/apiClient';

const BASE = '/users';

/**
 * What a user can be given.
 * @returns {Promise<{
 *   roles: [{ _id, name, type, status }],
 *   modules: [{ key, label, permissions }], masters: [{ _id, name, values }] (only with extra access allowed),
 *   settings: { canGiveExtraAccess, canGiveSeveralRoles }, limits: { usersAllowed }, today }>}
 */
export const getFormData = () => apiRequest(`${BASE}/form-data`);

/**
 * @param {{ search?: string, status?: 'A'|'I', roleId?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ users: Array, pagination: Object, limits: { usersAllowed, usersUsed }, today }>}
 *   Each user: { _id, name, username, email, phone, status, extraAccessCount,
 *   assignedRoles: [{ roleId, roleName, roleStatus, startDate, endDate }] }
 */
export const listUsers = ({ search, status, roleId, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (roleId) query.set('roleId', roleId);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ user: Object }>} - never the password */
export const getUser = (id) => apiRequest(`${BASE}/${id}`);

/**
 * data: { name, username, password, email?, phone?, address?,
 *   roles: [{ roleId, startDate?, endDate? }],
 *   extraModules: [{ module, permission, startDate?, endDate? }],
 *   extraMasters: [{ masterId, isWholeMaster, valueIds, startDate?, endDate? }] }
 * Dates 'YYYY-MM-DD'; an empty start = today, an empty end = no end.
 */
export const createUser = (data) => apiRequest(BASE, { method: 'POST', body: data });

/** Same data as createUser; password empty = unchanged. */
export const updateUser = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

export const setUserStatus = (id, isActive) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { isActive } });

export const deleteUser = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** action: 'activate' | 'deactivate' | 'delete' -> { results, successCount, failureCount } */
export const bulkUpdateUsers = (action, ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action, ids } });
