import { apiRequest } from '../../../utils/apiClient';

const BASE = '/notifications';

/**
 * The logged-in person's notifications, newest first.
 * @param {{ before?: string, limit?: number }} params - before: the createdAt of the oldest one shown
 * @returns {Promise<{ notifications: Array<{ _id, type, title, message, jobOrderId, readAt, createdAt }>, hasMore: boolean, unreadCount: number }>}
 */
export const listNotifications = ({ before, limit } = {}, { signal } = {}) => {
  const query = new URLSearchParams();
  if (before) query.set('before', before);
  if (limit) query.set('limit', limit);
  const qs = query.toString();
  return apiRequest(`${BASE}${qs ? `?${qs}` : ''}`, { signal });
};

/**
 * Marks notifications read (no ids = all of them).
 * @param {string[]} [ids]
 * @returns {Promise<{ unreadCount: number }>}
 */
export const markRead = (ids) => apiRequest(`${BASE}/read`, { method: 'PATCH', body: ids ? { ids } : {} });
