import { apiRequest } from '../../../utils/apiClient';

const BASE = '/layouts';

/**
 * What can be placed on a layout.
 * @returns {Promise<{ masters, controls, systemFields: [{ key, label }], paperSizes: [{ key, label, widthMm, heightMm }],
 *   settings: { canFormatText }, limits: { layoutsAllowed }, company: { name, logoUrl } }>}
 */
export const getFormData = () => apiRequest(`${BASE}/form-data`);

/**
 * @param {{ search?: string, status?: 'A'|'I', page?: number, limit?: number }} params
 * @returns {Promise<{ layouts: Array, pagination: Object, limits: { layoutsAllowed, layoutsUsed } }>}
 */
export const listLayouts = ({ search, status, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (status) query.set('status', status);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ layout: Object }>} */
export const getLayout = (id) => apiRequest(`${BASE}/${id}`);

/** data: { name, paper: { size, orientation, widthMm?, heightMm? }, labelDefault, elements } */
export const createLayout = (data) => apiRequest(BASE, { method: 'POST', body: data });

export const updateLayout = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

/** Picked in advance when a job order is printed. */
export const setDefaultLayout = (id) => apiRequest(`${BASE}/${id}/default`, { method: 'PATCH' });

export const setLayoutStatus = (id, isActive) => apiRequest(`${BASE}/${id}/status`, { method: 'PATCH', body: { isActive } });

export const deleteLayout = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** action: 'activate' | 'deactivate' | 'delete' -> { results, successCount, failureCount } */
export const bulkUpdateLayouts = (action, ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action, ids } });

/** The active layouts a job order can be printed with, default first. */
export const listLayoutsForPrint = ({ signal } = {}) => apiRequest(`${BASE}/for-print`, { signal });

/**
 * One layout and what fills it besides the job order.
 * @returns {Promise<{ layout, masters, controls, company: { name, logoUrl, byCountry }, settings: { canFormatText, useShortNames } }>}
 */
export const getLayoutForPrint = (id, { signal } = {}) => apiRequest(`${BASE}/for-print/${id}`, { signal });
