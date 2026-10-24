import { apiRequest } from '../../../utils/apiClient';

/**
 * Before logging in: under maintenance?
 * @returns {Promise<{ block: { state: string, message: string|null }|null }>}
 */
export const getPublicStatus = ({ signal } = {}) => apiRequest('/public/status', { auth: false, signal });

/**
 * Logged in: what blocks them (null = open), and the shop (the owner gets
 * its message and time too).
 * @returns {Promise<{ block: Object|null, shop: { isClosed: boolean, message?, resumeAt?, opensAutomatically? } }>}
 */
export const getMyStatus = ({ signal } = {}) => apiRequest('/service-status', { signal });

/**
 * The owner closes the shop (message and time to open again optional) or opens it.
 * @param {{ shopClosed: boolean, shopClosedMessage?: string|null, estimatedResumeTime?: string|null }} data
 * @returns {Promise<{ shop: Object }>}
 */
export const updateShop = (data) => apiRequest('/service-status/shop', { method: 'PUT', body: data });
