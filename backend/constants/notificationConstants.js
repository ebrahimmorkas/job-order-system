// Notifications (models/Notification.js) and the live updates sent over
// socket.io (services/realtimeService.js).

// What a notification is about.
const NOTIFICATION_TYPES = {
    // To a user: work on a job order was given to them / taken away / its time changed.
    WORK_GIVEN: 'workGiven',
    WORK_TAKEN: 'workTaken',
    TIME_CHANGED: 'timeChanged',
    // To the owner: someone moved their work to a step / put it on hold /
    // completed it, or it is past its due time.
    STEP_CHANGED: 'stepChanged',
    ON_HOLD: 'onHold',
    COMPLETED: 'completed',
    OVERDUE: 'overdue'
};
const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

// The bell loads this many at a time (and at most NOTIFICATION_LIST_MAX).
const NOTIFICATION_LIST_LIMIT = 20;
const NOTIFICATION_LIST_MAX = 50;
// Notifications delete themselves after this many days.
const NOTIFICATION_KEEP_DAYS = 90;

// How often the server looks for work that just went past its due time
// (services/overdueWatcher.js), and how far back - work overdue for longer
// (e.g. while the server was stopped) is not announced any more.
const OVERDUE_CHECK_MS = 60 * 1000;
const OVERDUE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// What the open pages are told over socket.io.
const REALTIME_EVENTS = {
    // A new notification for this person: { notification }.
    NOTIFICATION: 'notification',
    // A job order of the vendor was created, saved, cancelled or its work
    // moved: { jobOrderId } - lists and the dashboard load again.
    JOB_ORDERS_CHANGED: 'jobOrders:changed',
    // This person's work changed: { jobOrderId } - My work loads again.
    MY_WORK_CHANGED: 'myWork:changed',
    // Maintenance, payment or the shop changed - check the status again.
    SERVICE_STATUS_CHANGED: 'serviceStatus:changed',
    // This person read notifications (in another tab): { unreadCount }.
    NOTIFICATIONS_READ: 'notifications:read'
};

module.exports = {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_VALUES,
    NOTIFICATION_LIST_LIMIT,
    NOTIFICATION_LIST_MAX,
    NOTIFICATION_KEEP_DAYS,
    OVERDUE_CHECK_MS,
    OVERDUE_LOOKBACK_MS,
    REALTIME_EVENTS
};
