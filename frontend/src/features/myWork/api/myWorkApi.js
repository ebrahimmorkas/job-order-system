import { apiRequest } from '../../../utils/apiClient';

const BASE = '/my-work';

/**
 * The job orders the logged-in user is given work on, newest first; each
 * with work: [{ masterName, valueName, assignedAt, completeIn, dueAt, coWorkers }].
 * @returns {Promise<{ jobOrders: Array, pagination: Object }>}
 */
export const listMyWork = ({ search, page, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (search) query.set('search', search);
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/**
 * One of those job orders, read only and without any money.
 * @returns {Promise<{ jobOrder: Object, work: Array }>}
 */
export const getMyWorkJobOrder = (id, { signal } = {}) => apiRequest(`${BASE}/${id}`, { signal });

export default {
  listMyWork,
  getMyWorkJobOrder,
};
