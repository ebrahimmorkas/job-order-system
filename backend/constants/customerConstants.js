const { PHONE_PATTERN, EMAIL_MAX_LENGTH } = require('./rbacConstants');

// Customers (models/Customer.js), saved from job orders. Shared by the
// models, the Joi validations and the services so they can never disagree.

const CUSTOMER_NAME_MAX_LENGTH = 100;
// The same rules as a user's phone and email.
const CUSTOMER_PHONE_PATTERN = PHONE_PATTERN;
const CUSTOMER_EMAIL_MAX_LENGTH = EMAIL_MAX_LENGTH;
const CUSTOMER_PHONE_MESSAGE = 'Phone must be 10 to 13 digits, optionally starting with +';
// Largest page the customers list returns.
const CUSTOMER_LIST_MAX_PAGE_SIZE = 100;
// How many customers the job order form's search shows.
const CUSTOMER_SEARCH_RESULTS = 8;
const CUSTOMER_SEARCH_MAX_LENGTH = 100;

module.exports = {
    CUSTOMER_NAME_MAX_LENGTH,
    CUSTOMER_PHONE_PATTERN,
    CUSTOMER_EMAIL_MAX_LENGTH,
    CUSTOMER_PHONE_MESSAGE,
    CUSTOMER_LIST_MAX_PAGE_SIZE,
    CUSTOMER_SEARCH_RESULTS,
    CUSTOMER_SEARCH_MAX_LENGTH
};
