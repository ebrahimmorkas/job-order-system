import { apiRequest } from '../../../utils/apiClient';

/**
 * The current vendor's public branding (picked by the domain the app is opened on).
 * Public - the login page needs it before anyone logs in.
 * @returns {Promise<{ branding: { companyName: string|null, loginTagline: string|null, logoUrl: string|null } }>}
 */
export const getBranding = ({ signal } = {}) => apiRequest('/public/branding', { auth: false, signal });

export default {
  getBranding,
};
