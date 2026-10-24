// The dashboards (services/dashboardService.js).

// Where someone's work on a value is now.
const WORK_STATES = {
    NOT_STARTED: 'notStarted',
    IN_PROGRESS: 'inProgress',
    ON_HOLD: 'onHold',
    COMPLETED: 'completed'
};

const DASHBOARD_LIMITS = {
    // Rows of "who is working on what" (the most urgent first).
    WORKING: 50,
    // People in the workload chart (the busiest first).
    WORKLOAD: 10,
    // Latest step changes, from the last ACTIVITY_DAYS days.
    ACTIVITY: 15,
    ACTIVITY_DAYS: 14,
    // A user's own dashboard: what is due next.
    MY_NEXT: 5
};

module.exports = {
    WORK_STATES,
    DASHBOARD_LIMITS
};
