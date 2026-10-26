// The rows of a job order's summary, from a job order shaped as the backend
// stores it (models/JobOrder.js): the customer, then each item - its job
// name, every master picked and control filled in - then the prices. Used
// by the form and the views.

import { formatDueAt } from './workTime';
import { itemLabelOf } from './jobOrderItems';
import { measurementsOf, formatSize } from './jobOrderTotals';

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

// "2.3 × 4.1 = 9.43 sq ft (charged 11.25 sq ft)": the size of one piece of
// a per unit item (an empty measurement counts as 1).
export const sizeTextOf = (item) => {
  const { unit } = item;
  const names = measurementsOf(unit.measuredAs);
  const measured = names.map((name) => formatSize(item.measurements?.[name] ?? 1));
  const size = `${formatSize(item.size)} ${unit.name}`;
  const text = names.length > 1 ? `${measured.join(' × ')} = ${size}` : size;
  return item.chargeableSize !== item.size ? `${text} (charged ${formatSize(item.chargeableSize)} ${unit.name})` : text;
};

// How a price was worked out: "(5 × 11.25 sq ft × 100)", "(5 × edge 13.5 × 20)",
// "(5 × 200)"; "" when typed (or typed over).
const workedTextOf = (control, item) => {
  if (control.rate === null || control.rate === undefined || control.isAmountEdited) return '';
  const quantity = item.quantity ?? 1;
  const parts = quantity > 1 ? [quantity] : [];
  if (control.chargedBy === 'unit' && item.unit) parts.push(`${formatSize(control.factor)} ${item.unit.name}`);
  else if (control.chargedBy === 'edge') parts.push(`edge ${formatSize(control.factor)}`);
  if (parts.length === 0) return '';
  return ` (${[...parts, control.rate].join(' × ')})`;
};

/**
 * Several items: each starts with a heading row ("Item 2 · Square glass") and
 * its prices say which item they are of. One item: its job name is a row.
 * A price worked out as rate x quantity says so: "Cutting (5 × 200)", per
 * unit "Glass (5 × 11.25 sq ft × 100)"; a per unit item has a size row.
 * @param {{ customer, items: Array<{ name, quantity?, chargeBy?, unit?, measurements?, size?, chargeableSize?, masters, controls }> }} jobOrder
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
        const label = `${control.label}${workedTextOf(control, item)}${isSeveral ? ` (Item ${index + 1})` : ''}`;
        rows.push({ key, label, isPrice: true, amount: control.amount, isTaxed: control.isPriceIncludedInTax });
      } else if (control.type === 'checkbox') {
        if (control.checked) rows.push({ key, label: control.label, value: 'Yes' });
      } else if (control.type === 'radio' || control.type === 'dropdown') {
        if (control.optionName) rows.push({ key, label: control.label, value: control.optionName });
      } else if (control.text) {
        rows.push({ key, label: control.label, value: control.text });
      }
    }
    if (item.chargeBy === 'unit' && item.unit && item.size !== null && item.size !== undefined) {
      rows.push({ key: `${at}size`, label: 'Size (per piece)', value: sizeTextOf(item) });
    }
  });
  return rows;
};
