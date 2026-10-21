import { apiRequest } from '../../../utils/apiClient';

const BASE = '/masters';

/**
 * @param {{ search?: string, status?: 'A'|'I', page?: number, limit?: number }} params
 * @returns {Promise<{ masters: Array, pagination: Object, limits: { mastersAllowed, valuesAllowedPerMaster, mastersUsed } }>}
 */
export const listMasters = ({ search, status, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ master: Object (with values), limits: Object }>} */
export const getMaster = (id) => apiRequest(`${BASE}/${id}`);

/** data: { name, shortName, isMultiselectAllowed, values: [{ name, status }] } */
export const createMaster = (data) => apiRequest(BASE, { method: 'POST', body: data });

/**
 * Saves the details and the full values list together, in order. Existing
 * values carry their _id; values without one are new; existing ones left
 * out are deleted.
 * data: { name, shortName, isMultiselectAllowed, values: [{ _id?, name, status }] }
 */
export const updateMaster = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

export const setMasterStatus = (id, isActive) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { isActive } });

/** One place up or down in the whole list. direction: 'up' | 'down' */
export const moveMaster = (id, direction) => apiRequest(`${BASE}/${id}/move`, { method: 'PATCH', body: { direction } });

export const deleteMaster = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** action: 'activate' | 'deactivate' | 'delete' -> { results, successCount, failureCount } */
export const bulkUpdateMasters = (action, ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action, ids } });

// The values popup on the list - saved straight away.
export const setValueStatus = (id, valueId, isActive) =>
  apiRequest(`${BASE}/${id}/values/${valueId}/status`, { method: 'PATCH', body: { isActive } });

/** One place up or down inside its master. direction: 'up' | 'down' */
export const moveValue = (id, valueId, direction) =>
  apiRequest(`${BASE}/${id}/values/${valueId}/move`, { method: 'PATCH', body: { direction } });

export const deleteValue = (id, valueId) => apiRequest(`${BASE}/${id}/values/${valueId}`, { method: 'DELETE' });
