// Tax and the location masters (models/CurrencyMaster.js, CountryMaster.js,
// StateMaster.js, CityMaster.js, TaxMaster.js) and the vendor's tax details
// (CompanySettings.taxDetails). Shared by the models and the Joi validations
// so they can never disagree.

// A tax registration field of a country (CountryMaster.taxFields), e.g. India's
// GSTIN. Its key names the value in CompanySettings.taxDetails[].taxFieldValues.
const TAX_FIELD_KEY_PATTERN = /^[a-z][a-zA-Z0-9]{0,29}$/;
const TAX_FIELD_VALUE_MAX_LENGTH = 50;

// The business address of each assigned country (CompanySettings.taxDetails[].address).
const ADDRESS_LINE_MAX_LENGTH = 150;
const POSTAL_CODE_MAX_LENGTH = 20;

module.exports = {
    TAX_FIELD_KEY_PATTERN,
    TAX_FIELD_VALUE_MAX_LENGTH,
    ADDRESS_LINE_MAX_LENGTH,
    POSTAL_CODE_MAX_LENGTH
};
