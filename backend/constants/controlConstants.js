// Controls module (models/Control.js). Shared by the model, the Joi
// validations and CompanyMaster so they can never disagree.

// The kinds of control a vendor can create. CompanyMaster.assignedControls
// picks which of them a vendor gets.
const CONTROL_TYPES = {
    TEXTFIELD: 'textfield',
    TEXTAREA: 'textarea',
    CHECKBOX: 'checkbox',
    RADIO: 'radio',
    // One choice from a list; with per unit pricing it can be the unit dropdown.
    DROPDOWN: 'dropdown'
};
const CONTROL_TYPE_VALUES = Object.values(CONTROL_TYPES);
// Controls the job order user types into (they have a placeholder and a default text).
const TEXT_CONTROL_TYPES = [CONTROL_TYPES.TEXTFIELD, CONTROL_TYPES.TEXTAREA];

// The longest label / placeholder of a control is set per vendor in
// CompanyMaster (maxTextForLabelIn...Control, maxTextForPlaceholderIn...Control).

// Longest search text on the controls list.
const CONTROL_SEARCH_MAX_LENGTH = 200;
// A text field that is a price takes an amount: no minus, at most 2 decimals
// (150, 150.5, 150.50).
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
// A quantity text field takes a whole number from 1 to 999999.
const QUANTITY_PATTERN = /^[1-9]\d{0,5}$/;

// A radio group needs at least two choices.
const MIN_RADIO_OPTIONS = 2;
// Controls whose answer is one of their choices.
const CHOICE_CONTROL_TYPES = [CONTROL_TYPES.RADIO, CONTROL_TYPES.DROPDOWN];

// Largest page the controls list returns.
const CONTROL_LIST_MAX_PAGE_SIZE = 100;

module.exports = {
    CONTROL_TYPES,
    CONTROL_TYPE_VALUES,
    TEXT_CONTROL_TYPES,
    CONTROL_SEARCH_MAX_LENGTH,
    PRICE_PATTERN,
    QUANTITY_PATTERN,
    MIN_RADIO_OPTIONS,
    CHOICE_CONTROL_TYPES,
    CONTROL_LIST_MAX_PAGE_SIZE
};
