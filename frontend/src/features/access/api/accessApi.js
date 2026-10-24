import { apiRequest } from '../../../utils/apiClient';

/**
 * What the logged-in person may do: the owner everything; a user the modules
 * and permissions of their roles, and whether they have work ("My work").
 * @returns {Promise<{ access: { isOwner: boolean, modules: Object<string, string[]>, hasWork: boolean } }>}
 */
export const getMyAccess = ({ signal } = {}) => apiRequest('/access', { signal });

export default {
  getMyAccess,
};
