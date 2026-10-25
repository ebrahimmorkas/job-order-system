import { apiRequest } from '../../../utils/apiClient';

const BASE = '/my-work';

/**
 * The job orders the logged-in user is given work on, newest first; each
 * with work: [{ itemId, itemLabel, masterName, valueName, assignedAt, completeIn, dueAt, coWorkers }].
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
 * One of those job orders, read only and without any money, with the
 * vendor's steps (none while steps are off).
 * @returns {Promise<{ jobOrder: Object, work: Array, steps: Array<{ key, fixedStep, name }> }>}
 */
export const getMyWorkJobOrder = (id, { signal } = {}) => apiRequest(`${BASE}/${id}`, { signal });

/**
 * Moves the user's work on one value of an item to a step (In progress may take a %,
 * Hold a reason).
 * @param {string} id - The job order
 * @param {{ itemId: string, valueId: string, stepKey: string, percent?: number|null, holdReason?: string|null }} data
 * @returns {Promise<{ step: Object }>}
 */
export const setMyStep = (id, data) => apiRequest(`${BASE}/${id}/step`, { method: 'PATCH', body: data });

export default {
  listMyWork,
  getMyWorkJobOrder,
  setMyStep,
};
