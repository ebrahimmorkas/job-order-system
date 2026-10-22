import { apiRequest } from '../../../utils/apiClient';

const BASE = '/controls';

/**
 * @param {{ search?: string, status?: 'A'|'I', type?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ controls: Array, pagination: Object, limits: Object }>}
 *   limits: { assignedTypes, controlsAllowed, controlsUsed, maxLength, maxLabelLength, maxPlaceholderLength, optionsAllowed } (null = no limit)
 */
export const listControls = ({ search, status, type, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (type) query.set('type', type);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ control: Object, limits: Object }>} */
export const getControl = (id) => apiRequest(`${BASE}/${id}`);

/**
 * data: { type, label, isRequired, placeholder?, defaultText? (text types),
 * defaultChecked? (checkbox), options? [{ _id?, name, isDefault }] (radio) }
 */
export const createControl = (data) => apiRequest(BASE, { method: 'POST', body: data });

/** Same data as createControl; the type can't change. */
export const updateControl = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

export const setControlStatus = (id, isActive) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { isActive } });

/** One place up or down in the whole list. direction: 'up' | 'down' */
export const moveControl = (id, direction) => apiRequest(`${BASE}/${id}/move`, { method: 'PATCH', body: { direction } });

export const deleteControl = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** action: 'activate' | 'deactivate' | 'delete' -> { results, successCount, failureCount } */
export const bulkUpdateControls = (action, ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action, ids } });
