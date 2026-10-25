// The rows of a job order's summary, from a job order shaped as the backend
// stores it (models/JobOrder.js): the customer, every master picked and
// control filled in, then the prices. Used by the form and the view.

import { formatDueAt } from './workTime';

/** The customer's address as one line ("" when nothing is filled in). */
export const customerLineOf = (customer) =>
  [customer?.address, customer?.cityName, customer?.stateName, customer?.postalCode, customer?.countryName].filter(Boolean).join(', ');

/** The customer's name, phone and email as one line ("" when none is filled in). */
export const customerContactOf = (customer) =>
  [customer?.name, customer?.phone, customer?.email].filter(Boolean).join(' · ');

/** A master's name on screen: its short name when short names are used. */
export const masterLabelOf = (master, useShortNames) => (useShortNames && master.shortName) || master.name;

// "Round cutting (Ravi, Sam - due 24 Oct 2026, 05:00 pm)": a value, who was
// given its work and by when.
const valueTextOf = (value) => {
  if (!value.assignedTo?.length) return value.name;
  const due = value.dueAt ? ` - due ${formatDueAt(value.dueAt)}` : '';
  return `${value.name} (${value.assignedTo.map((person) => person.name).join(', ')}${due})`;
};

/**
 * @param {{ customer, masters, controls }} jobOrder
 * @param {{ useShortNames?: boolean, showCustomer?: boolean }} options
 * @returns {Array<{ key, label, value?, isPrice?, amount?, isTaxed? }>}
 */
export const summaryRowsOf = ({ customer, masters, controls }, { useShortNames = false, showCustomer = true } = {}) => {
  const rows = [];
  const customerContact = showCustomer ? customerContactOf(customer) : '';
  if (customerContact) rows.push({ key: 'customerContact', label: 'Customer', value: customerContact });
  const customerLine = showCustomer ? customerLineOf(customer) : '';
  if (customerLine) rows.push({ key: 'customer', label: 'Customer address', value: customerLine });

  for (const master of masters) {
    if (master.values.length === 0) continue;
    rows.push({ key: `m-${master.masterId}`, label: masterLabelOf(master, useShortNames), value: master.values.map(valueTextOf).join(', ') });
  }
  for (const control of controls) {
    const key = `c-${control.controlId}`;
    if (control.isPrice) {
      rows.push({ key, label: control.label, isPrice: true, amount: control.amount, isTaxed: control.isPriceIncludedInTax });
    } else if (control.type === 'checkbox') {
      if (control.checked) rows.push({ key, label: control.label, value: 'Yes' });
    } else if (control.type === 'radio') {
      if (control.optionName) rows.push({ key, label: control.label, value: control.optionName });
    } else if (control.text) {
      rows.push({ key, label: control.label, value: control.text });
    }
  }
  return rows;
};
