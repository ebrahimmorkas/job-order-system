// The same checks the backend makes on a country's tax details
// (services/taxSettingsService.js), so most mistakes show before saving.
// The rules themselves come from the country (CountryMaster).

const matches = (pattern, value) => !pattern || new RegExp(pattern).test(value);

/**
 * @param {Object} country - From GET /company-settings/tax
 * @param {Object} form - { line1, line2, stateId, cityId, postalCode, isTaxRegistered, taxFieldValues, defaultTaxId }
 * @returns {Object<string, string>} message by field ('address.stateId', 'taxFieldValues.gstin', ...)
 */
export const checkTaxDetails = (country, form) => {
  const errors = {};
  const add = (field, message) => { if (!errors[field]) errors[field] = message; };
  const postal = country.postalCode || {};
  const postalLabel = postal.label || 'postal code';
  const state = country.states.find((s) => s._id === form.stateId);

  if (form.postalCode.trim() && !matches(postal.pattern, form.postalCode.trim())) {
    add('address.postalCode', postal.patternMessage || `Enter a valid ${postalLabel}`);
  }
  if (!form.isTaxRegistered) return errors;

  if (!form.line1.trim()) add('address.line1', 'Enter the address');
  if (!form.stateId) add('address.stateId', 'Choose the state');
  if (!form.cityId) add('address.cityId', 'Choose the city');
  if (postal.isRequired && !form.postalCode.trim()) add('address.postalCode', `Enter the ${postalLabel}`);

  for (const field of country.taxFields) {
    const name = `taxFieldValues.${field.key}`;
    const value = (form.taxFieldValues[field.key] || '').trim().toUpperCase();
    if (!value) {
      if (field.isRequired) add(name, `Enter the ${field.label}`);
    } else if (!matches(field.pattern, value)) {
      add(name, field.patternMessage || `Enter a valid ${field.label}`);
    } else if (field.startsWithStateTaxCode && state?.taxCode && !value.startsWith(state.taxCode)) {
      add(name, `The ${field.label} of a business in ${state.name} starts with ${state.taxCode}`);
    }
  }
  return errors;
};

/** "GST 18% (CGST 9% + SGST 9%)" */
export const taxLabel = (tax) =>
  tax.components?.length > 0 ? `${tax.name} (${tax.components.map((c) => `${c.label} ${c.rate}%`).join(' + ')})` : tax.name;
