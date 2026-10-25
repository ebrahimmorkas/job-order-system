import { apiRequest } from '../../../utils/apiClient';

const BASE = '/customers';

/**
 * The job order form's search: any part of the name, phone, email or address.
 * @returns {Promise<{ customers: Array }>} - at most 8, each { _id, name, phone, email, address }
 */
export const searchForJobOrder = (search, { signal } = {}) =>
  apiRequest(`${BASE}/for-job-order?search=${encodeURIComponent(search)}`, { signal });

/** @returns {Promise<{ countries: Array }>} - for the address: { _id, name, states, cities, postalCode } */
export const getFormData = () => apiRequest(`${BASE}/form-data`);

/**
 * @param {{ search?: string, page?: number, limit?: number }} params
 * @returns {Promise<{ customers: Array, pagination: Object }>}
 *   Each: { _id, name, phone, email, address, lastJobOrderAt, jobOrderCount }
 */
export const listCustomers = ({ search, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/** @returns {Promise<{ customer: Object }>} */
export const getCustomer = (id) => apiRequest(`${BASE}/${id}`);

/**
 * data: { name?, phone?, email?, address: { countryId?, stateId?, cityId?, postalCode?, address? } }
 * A phone or an email is required.
 */
export const updateCustomer = (id, data) => apiRequest(`${BASE}/${id}`, { method: 'PUT', body: data });

export const deleteCustomer = (id) => apiRequest(`${BASE}/${id}`, { method: 'DELETE' });

/** -> { results, successCount, failureCount } */
export const bulkDeleteCustomers = (ids) => apiRequest(`${BASE}/bulk`, { method: 'POST', body: { action: 'delete', ids } });
