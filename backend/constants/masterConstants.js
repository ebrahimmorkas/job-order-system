// Master module (models/Master.js, models/MasterValue.js). Shared by the
// models and the Joi validations so the two can never disagree.
const MASTER_NAME_MIN_LENGTH = 2;
const MASTER_NAME_MAX_LENGTH = 50;
const MASTER_SHORT_NAME_MAX_LENGTH = 10;
const MASTER_VALUE_NAME_MAX_LENGTH = 100;

// "My Services" and "my services" are the same name: compared with this
// collation (strength 2 = ignore case) by the unique indexes.
const CASE_INSENSITIVE_COLLATION = { locale: 'en', strength: 2 };

// The statuses that still count - for uniqueness and for the vendor's limits.
// Deleted ('D') masters / values free their name and their place.
const LIVE_STATUSES = ['A', 'I'];

// Largest page the masters list returns.
const MASTER_LIST_MAX_PAGE_SIZE = 100;

module.exports = {
    MASTER_NAME_MIN_LENGTH,
    MASTER_NAME_MAX_LENGTH,
    MASTER_SHORT_NAME_MAX_LENGTH,
    MASTER_VALUE_NAME_MAX_LENGTH,
    CASE_INSENSITIVE_COLLATION,
    LIVE_STATUSES,
    MASTER_LIST_MAX_PAGE_SIZE
};
