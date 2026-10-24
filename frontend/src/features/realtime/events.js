// What the server sends over socket.io - the same as the backend
// (constants/notificationConstants.js REALTIME_EVENTS).
export const REALTIME_EVENTS = {
  // A new notification for this person: { notification }.
  NOTIFICATION: 'notification',
  // A job order was created, saved, cancelled or its work moved: { jobOrderId }.
  JOB_ORDERS_CHANGED: 'jobOrders:changed',
  // This person's work changed: { jobOrderId }.
  MY_WORK_CHANGED: 'myWork:changed',
  // Maintenance, payment or the shop changed.
  SERVICE_STATUS_CHANGED: 'serviceStatus:changed',
  // This person read notifications (in another tab): { unreadCount }.
  NOTIFICATIONS_READ: 'notifications:read',
  // Not from the server: connected again after losing the connection -
  // anything may have been missed, so load again.
  RECONNECTED: 'reconnected',
};
