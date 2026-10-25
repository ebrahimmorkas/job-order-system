// Job orders (models/JobOrder.js) and their Company Settings. Shared by the
// models, the Joi validations and the services so they can never disagree.

// Where a master's short name is shown instead of its name
// (CompanySettings.useShortNamesOn). Print comes later.
const SHORT_NAME_PLACES = {
    NOWHERE: 'none',
    JOB_ORDER: 'jobOrder',
    PRINT: 'print',
    BOTH: 'both'
};
const SHORT_NAME_PLACE_VALUES = Object.values(SHORT_NAME_PLACES);

// A number made by the app: JO-0001, JO-0002... per vendor.
const AUTO_NUMBER_PREFIX = 'JO-';
const AUTO_NUMBER_DIGITS = 4;
// A number typed by the owner (when it isn't made by the app).
const JOB_ORDER_NUMBER_MAX_LENGTH = 30;

// What the "Work given" field of a print layout shows for each person
// (CompanySettings.printWork); all on until the owner turns them off.
const PRINT_WORK_OPTIONS = ['showWorkers', 'showStartDate', 'showDueTime', 'showStep', 'showHoldReason'];

// The customer's address on a job order.
const CUSTOMER_ADDRESS_MAX_LENGTH = 500;
// A text field / text area answer when the vendor set no limit.
const ANSWER_MAX_LENGTH = 5000;

// The items of one job order (each with its own job name, masters, controls,
// images and work). CompanyMaster.numberOfItemsAllowedToAddInJobOrder sets
// the vendor's own limit (1 when not set); never more than this.
const JOB_ORDER_ITEMS_MAX = 50;
const DEFAULT_ITEMS_ALLOWED = 1;
// An item's job name.
const JOB_NAME_MAX_LENGTH = 100;

// Most people one picked master value (its work) can be given to.
const ASSIGNEES_PER_VALUE_MAX = 20;

// How long a picked value's work may take: a number and one of these units.
const DURATION_UNITS = ['seconds', 'minutes', 'hours', 'days', 'months', 'years'];
const DURATION_AMOUNT_MAX = 9999;

// Largest page the job order list returns.
const JOB_ORDER_LIST_MAX_PAGE_SIZE = 100;

module.exports = {
    SHORT_NAME_PLACES,
    SHORT_NAME_PLACE_VALUES,
    AUTO_NUMBER_PREFIX,
    AUTO_NUMBER_DIGITS,
    JOB_ORDER_NUMBER_MAX_LENGTH,
    PRINT_WORK_OPTIONS,
    CUSTOMER_ADDRESS_MAX_LENGTH,
    ANSWER_MAX_LENGTH,
    JOB_ORDER_ITEMS_MAX,
    DEFAULT_ITEMS_ALLOWED,
    JOB_NAME_MAX_LENGTH,
    ASSIGNEES_PER_VALUE_MAX,
    DURATION_UNITS,
    DURATION_AMOUNT_MAX,
    JOB_ORDER_LIST_MAX_PAGE_SIZE
};
