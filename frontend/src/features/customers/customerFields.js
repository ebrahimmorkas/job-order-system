// A customer's details on a form (the job order form and the customer edit
// screen): name, phone, email and the address, as one flat object. The same
// limits as the backend (constants/customerConstants.js).

export const CUSTOMER_NAME_MAX_LENGTH = 100;
export const CUSTOMER_EMAIL_MAX_LENGTH = 100;
export const CUSTOMER_ADDRESS_MAX_LENGTH = 500;
export const POSTAL_CODE_MAX_LENGTH = 20;
const PHONE_PATTERN = /^\+?\d{10,13}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMPTY_CUSTOMER = { name: '', phone: '', email: '', countryId: '', stateId: '', cityId: '', postalCode: '', address: '' };

const idOf = (value) => (value ? String(value) : '');

/**
 * Saved details on the form: a country, state or city no longer available is
 * left out (the vendor's only country is chosen by itself).
 * @param {Array} countries - { _id, states, cities }
 * @param {Object} saved - { name, phone, email, countryId, stateId, cityId, postalCode, address }
 */
export const formCustomerOf = (countries, saved = {}) => {
  const country = countries.find((c) => c._id === idOf(saved.countryId)) || (countries.length === 1 ? countries[0] : null);
  const state = country?.states.find((s) => s._id === idOf(saved.stateId));
  const city = state && country.cities.find((c) => c._id === idOf(saved.cityId) && c.stateId === state._id);
  return {
    name: saved.name || '',
    phone: saved.phone || '',
    email: saved.email || '',
    countryId: country?._id || '',
    stateId: state?._id || '',
    cityId: city?._id || '',
    postalCode: saved.postalCode || '',
    address: saved.address || '',
  };
};

/** The phone and email checks: { phone?, email? } with a message each. */
export const contactErrorsOf = (customer) => {
  const errors = {};
  const phone = customer.phone.trim();
  const email = customer.email.trim();
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = 'Phone must be 10 to 13 digits, optionally starting with +';
  if (email && (!EMAIL_PATTERN.test(email) || email.length > CUSTOMER_EMAIL_MAX_LENGTH)) errors.email = 'Enter a valid email';
  return errors;
};

/** The postal code check of the chosen country: a message, or ''. */
export const postalErrorOf = (country, postalCode) => {
  const postal = country?.postalCode;
  const code = postalCode.trim();
  if (!code || !postal?.pattern || new RegExp(postal.pattern).test(code)) return '';
  return postal.patternMessage || `Enter a valid ${postal.label || 'postal code'}`;
};

/** What the backend takes: trimmed, '' as null. */
export const contactPayloadOf = (customer) => ({
  name: customer.name.trim() || null,
  phone: customer.phone.trim() || null,
  email: customer.email.trim() || null,
});

export const addressPayloadOf = (customer) => ({
  countryId: customer.countryId || null,
  stateId: customer.stateId || null,
  cityId: customer.cityId || null,
  postalCode: customer.postalCode.trim(),
  address: customer.address.trim(),
});
