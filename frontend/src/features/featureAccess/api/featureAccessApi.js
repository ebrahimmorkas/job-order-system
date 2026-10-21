import { apiRequest } from '../../../utils/apiClient';

/**
 * Which features are on for this vendor (on platform-wide AND for the vendor).
 * @returns {Promise<{ featureAccess: Object<string, boolean> }>}
 */
export const getFeatureAccess = ({ signal } = {}) => apiRequest('/feature-access', { signal });

export default {
  getFeatureAccess,
};
