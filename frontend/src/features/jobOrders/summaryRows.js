// The rows of a job order's summary, from a job order shaped as the backend
// stores it (models/JobOrder.js): the customer, then each item - its job
// name, every master picked and control filled in - then the prices. Used
// by the form and the views.

import { formatDueAt } from './workTime';
import { itemLabelOf } from './jobOrderItems';

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
 * Several items: each starts with a heading row ("Item 2 · Square glass") and
 * its prices say which item they are of. One item: its job name is a row.
 * @param {{ customer, items: Array<{ name, masters, controls }> }} jobOrder
 * @param {{ useShortNames?: boolean, showCustomer?: boolean }} options
 * @returns {Array<{ key, label?, heading?, value?, isPrice?, amount?, isTaxed? }>}
 */
export const summaryRowsOf = ({ customer, items }, { useShortNames = false, showCustomer = true } = {}) => {
  const rows = [];
  const customerContact = showCustomer ? customerContactOf(customer) : '';
  if (customerContact) rows.push({ key: 'customerContact', label: 'Customer', value: customerContact });
  const customerLine = showCustomer ? customerLineOf(customer) : '';
  if (customerLine) rows.push({ key: 'customer', label: 'Customer address', value: customerLine });

  const isSeveral = items.length > 1;
  items.forEach((item, index) => {
    const at = `${index}-`;
    if (isSeveral) rows.push({ key: `item-${index}`, heading: itemLabelOf(item, index, items.length) });
    else if (item.name) rows.push({ key: `${at}name`, label: 'Job name', value: item.name });
    for (const master of item.masters) {
      if (master.values.length === 0) continue;
      rows.push({ key: `${at}m-${master.masterId}`, label: masterLabelOf(master, useShortNames), value: master.values.map(valueTextOf).join(', ') });
    }
    for (const control of item.controls) {
      const key = `${at}c-${control.controlId}`;
      if (control.isPrice) {
        const label = isSeveral ? `${control.label} (Item ${index + 1})` : control.label;
        rows.push({ key, label, isPrice: true, amount: control.amount, isTaxed: control.isPriceIncludedInTax });
      } else if (control.type === 'checkbox') {
        if (control.checked) rows.push({ key, label: control.label, value: 'Yes' });
      } else if (control.type === 'radio') {
        if (control.optionName) rows.push({ key, label: control.label, value: control.optionName });
      } else if (control.text) {
        rows.push({ key, label: control.label, value: control.text });
      }
    }
  });
  return rows;
};
