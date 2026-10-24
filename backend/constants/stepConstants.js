// Steps of assigned work (Start, In progress, Hold, Completed...). Which steps
// a vendor has, their names and order are set by the platform owner in
// CompanyMaster.steps (no screens) - see services/stepService.js.

// The steps the app knows. A vendor uses any of them (each at most once), in
// any order, next to steps of its own (fixedStep null - just a name).
const FIXED_STEPS = {
    START: 'start',
    // Asks how much of the work is done, in % (optional).
    IN_PROGRESS: 'inProgress',
    // Asks why the work is on hold (optional).
    HOLD: 'hold',
    // The work is done: no more "Overdue".
    COMPLETED: 'completed'
};
const FIXED_STEP_VALUES = Object.values(FIXED_STEPS);

// The name shown when CompanyMaster.steps gives a fixed step no name.
const FIXED_STEP_NAMES = {
    [FIXED_STEPS.START]: 'Start',
    [FIXED_STEPS.IN_PROGRESS]: 'In progress',
    [FIXED_STEPS.HOLD]: 'Hold',
    [FIXED_STEPS.COMPLETED]: 'Completed'
};

const STEP_NAME_MAX_LENGTH = 50;
const HOLD_REASON_MAX_LENGTH = 500;
// Steps kept in a person's history on one job order value (the oldest drop off).
const STEP_HISTORY_MAX = 100;

// When the completion time of assigned work starts counting
// (CompanySettings.workTimeStartsOn).
const WORK_TIME_STARTS = {
    // As soon as the work is given (the job order is created / saved).
    ON_ASSIGN: 'onAssign',
    // When each person changes their first step (only while steps are on).
    ON_FIRST_STEP: 'onFirstStep'
};
const WORK_TIME_START_VALUES = Object.values(WORK_TIME_STARTS);

module.exports = {
    FIXED_STEPS,
    FIXED_STEP_VALUES,
    FIXED_STEP_NAMES,
    STEP_NAME_MAX_LENGTH,
    HOLD_REASON_MAX_LENGTH,
    STEP_HISTORY_MAX,
    WORK_TIME_STARTS,
    WORK_TIME_START_VALUES
};
