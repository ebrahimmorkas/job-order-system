import { apiRequest } from '../../../utils/apiClient';

/**
 * The owner's dashboard (or a user's with Dashboard): the whole vendor's work.
 * @returns {Promise<{ now, totals, working: Array, workingTotal: number, workload: Array, workloadTotal: number, activity: Array }>}
 */
export const getDashboard = ({ signal } = {}) => apiRequest('/dashboard', { signal });

/**
 * A user's own work: how many of each and what is due next.
 * @returns {Promise<{ now, totals, next: Array }>}
 */
export const getMySummary = ({ signal } = {}) => apiRequest('/my-work/summary', { signal });
