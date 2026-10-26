import { formatMoney } from '../jobOrders/jobOrderTotals';
import { customerLineOf, masterLabelOf, sizeTextOf } from '../jobOrders/summaryRows';
import { formatDueAt } from '../jobOrders/workTime';
import { ITEM_FIELD_KEYS } from './layoutConstants';

// What a field on a layout shows: { label, value }. In the designer the value
// is a placeholder ("[Cutting]"); printing a job order fills in its values.
// A resolver takes the field and where it is printed: { itemIndex } in a
// table row repeated for each item (that item's value), { page } for the page
// number. Without itemIndex a master, control or item field shows every
// item's value, one per line ("1. Round"), or just the value with one item.

const SYSTEM_LABELS = {
  jobOrderNumber: 'Job order number',
  jobOrderDate: 'Date',
  deliveryDate: 'Delivery date',
  customerName: 'Customer name',
  customerPhone: 'Customer phone',
  customerEmail: 'Customer email',
  customerAddress: 'Customer address',
  subtotal: 'Subtotal',
  discount: 'Discount',
  taxSummary: 'Tax',
  total: 'Total',
  advance: 'Advance',
  balance: 'Balance',
  companyName: 'Company name',
  companyAddress: 'Company address',
  companyTaxIds: 'Company tax numbers',
  workDetails: 'Work given',
  pageNumber: 'Page number',
  itemNumber: 'Item no.',
  itemName: 'Job order name',
  itemQuantity: 'Quantity',
  itemSize: 'Size',
  itemAmount: 'Item amount',
  itemUnitPrice: 'Price for one',
};

const byId = (docs) => new Map((docs || []).map((doc) => [doc._id, doc]));

const pageText = (page) => `Page ${page?.number ?? 1} of ${page?.count ?? 1}`;

/** The text of a field: "label: value", or the value alone; nothing at all when it has no value. */
export const fieldText = (field, { label, value }) => {
  if (!value) return '';
  if (!field.showLabel) return value;
  const shown = field.labelText || label;
  return shown ? `${shown}: ${value}` : value;
};

/**
 * Placeholders for the designer and template exports.
 * @param {{ masters, controls, systemFields }} sources - From the form data
 */
export const placeholderResolver = ({ masters, controls, systemFields }) => {
  const masterById = byId(masters);
  const controlById = byId(controls);
  const systemByKey = new Map((systemFields || []).map((f) => [f.key, f.label]));
  return (field, { itemIndex, page } = {}) => {
    let label;
    if (field.source === 'master') label = masterById.get(field.refId)?.name;
    else if (field.source === 'control') label = controlById.get(field.refId)?.label;
    else label = systemByKey.get(field.key) || SYSTEM_LABELS[field.key];
    if (!label) return { label: 'Removed', value: '[removed]', isMissing: true };
    if (field.key === 'pageNumber') return { label, value: pageText(page) };
    if (field.key === 'itemNumber' && itemIndex !== undefined) return { label, value: String(itemIndex + 1) };
    return { label, value: field.perOne ? `[${label} for one]` : `[${label}]` };
  };
};

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// One person's line: what Company Settings > Job orders says to print
// (printWork), e.g. "Ravi · In progress 40% · started 24 Oct 2026 · due 26 Oct 2026, 05:30 pm".
const personLineOf = (person, value, printWork) => {
  const step = person.step;
  const parts = [];
  if (printWork.showWorkers) parts.push(person.name);
  if (printWork.showStep) parts.push(step ? `${step.name}${step.percent !== null && step.percent !== undefined ? ` ${step.percent}%` : ''}` : 'Not started');
  if (printWork.showHoldReason && step?.fixedStep === 'hold' && step.holdReason) parts.push(`On hold: ${step.holdReason}`);
  if (printWork.showStartDate && person.startedAt) parts.push(`started ${formatDate(person.startedAt)}`);
  const dueAt = person.dueAt ?? value.dueAt;
  if (printWork.showDueTime && dueAt) parts.push(`due ${formatDueAt(dueAt)}`);
  return parts.join(' · ');
};

// The "Work given" of one item: each value with work, then a line per person.
const workLinesOf = (item, printWork, useShortNames) => {
  const lines = [];
  for (const master of item.masters) {
    for (const value of master.values) {
      if (!value.assignedTo?.length) continue;
      lines.push(`${value.name} (${masterLabelOf(master, useShortNames)})`);
      for (const person of value.assignedTo) {
        const line = personLineOf(person, value, printWork);
        if (line) lines.push(`  ${line}`);
      }
    }
  }
  return lines;
};

/**
 * A job order's real values.
 * @param {Object} jobOrder - As saved (models/JobOrder.js), with its items
 * @param {{ masters, controls, company: { name, byCountry }, settings: { useShortNames, printWork } }} printData
 */
export const jobOrderResolver = (jobOrder, { masters, controls, company, settings }) => {
  const masterNames = byId(masters);
  const controlNames = byId(controls);
  const items = jobOrder.items || [];
  const money = (amount) => formatMoney(amount, jobOrder.currency);
  const countryId = jobOrder.tax?.countryId || jobOrder.customer?.countryId || Object.keys(company.byCountry || {})[0];
  const companyHere = company.byCountry?.[countryId] || { address: '', taxIds: [] };
  const printWork = settings.printWork || {};

  const SYSTEM_VALUES = {
    jobOrderNumber: () => jobOrder.jobOrderNumber,
    jobOrderDate: () => formatDate(jobOrder.createdAt),
    deliveryDate: () => (jobOrder.deliveryAt ? formatDate(jobOrder.deliveryAt) : ''),
    customerName: () => jobOrder.customer?.name || '',
    customerPhone: () => jobOrder.customer?.phone || '',
    customerEmail: () => jobOrder.customer?.email || '',
    customerAddress: () => customerLineOf(jobOrder.customer),
    subtotal: () => money(jobOrder.subtotal),
    discount: () => {
      const { discount } = jobOrder;
      if (!discount?.amount) return '';
      return discount.type === 'percent' ? `${money(discount.amount)} (${discount.value}%)` : money(discount.amount);
    },
    taxSummary: () => (jobOrder.tax?.isApplied ? jobOrder.tax.components.map((c) => `${c.label} ${c.rate}%: ${money(c.amount)}`).join('\n') : ''),
    total: () => money(jobOrder.total),
    advance: () => (jobOrder.advance === null || jobOrder.advance === undefined ? '' : money(jobOrder.advance)),
    balance: () => (jobOrder.balance === null || jobOrder.balance === undefined ? '' : money(jobOrder.balance)),
    companyName: () => company.name,
    companyAddress: () => companyHere.address,
    companyTaxIds: () => companyHere.taxIds.map((t) => `${t.label}: ${t.value}`).join('\n'),
  };

  // A master / control / item field's value on one item ('' = none).
  const itemValueOf = (field, item, index) => {
    if (field.source === 'master') {
      const picked = item.masters.find((m) => m.masterId === field.refId);
      return picked ? picked.values.map((v) => v.name).join(', ') : '';
    }
    if (field.source === 'control') {
      const answer = item.controls.find((c) => c.controlId === field.refId);
      if (!answer) return '';
      if (answer.isPrice) {
        if (answer.amount === null || answer.amount === undefined) return '';
        // "Price for one": divided by the item's quantity.
        return money(field.perOne ? answer.amount / (item.quantity || 1) : answer.amount);
      }
      if (answer.type === 'checkbox') return answer.checked === null || answer.checked === undefined ? '' : (answer.checked ? 'Yes' : 'No');
      if (answer.type === 'radio' || answer.type === 'dropdown') return answer.optionName || '';
      return answer.text || '';
    }
    switch (field.key) {
      case 'itemNumber': return String(index + 1);
      case 'itemName': return item.name || '';
      case 'itemQuantity': return item.quantity ? String(item.quantity) : '';
      case 'itemSize': return item.chargeBy === 'unit' && item.unit && item.size !== null && item.size !== undefined ? sizeTextOf(item) : '';
      case 'itemAmount':
      case 'itemUnitPrice': {
        const prices = item.controls.filter((c) => c.isPrice && c.amount !== null && c.amount !== undefined);
        if (prices.length === 0) return '';
        const amount = prices.reduce((sum, c) => sum + c.amount, 0);
        return money(field.key === 'itemUnitPrice' ? amount / (item.quantity || 1) : amount);
      }
      case 'workDetails': return workLinesOf(item, printWork, settings.useShortNames).join('\n');
      default: return '';
    }
  };

  // Every item's value: just the value with one item, else "1. Round" lines
  // (items without a value left out). Work given goes under each item's name.
  const allItemsValueOf = (field) => {
    if (items.length === 1) return itemValueOf(field, items[0], 0);
    const lines = [];
    items.forEach((item, index) => {
      const value = itemValueOf(field, item, index);
      if (!value) return;
      if (field.key === 'workDetails') lines.push(`Item ${index + 1}${item.name ? ` · ${item.name}` : ''}`, ...value.split('\n').map((line) => `  ${line}`));
      else lines.push(`${index + 1}. ${value}`);
    });
    return lines.join('\n');
  };

  const labelOf = (field) => {
    if (field.source === 'master') {
      const named = items.flatMap((item) => item.masters).find((m) => m.masterId === field.refId) || masterNames.get(field.refId);
      return named ? masterLabelOf(named, settings.useShortNames) : '';
    }
    if (field.source === 'control') {
      return items.flatMap((item) => item.controls).find((c) => c.controlId === field.refId)?.label || controlNames.get(field.refId)?.label || '';
    }
    return SYSTEM_LABELS[field.key];
  };

  return (field, { itemIndex, page } = {}) => {
    const label = labelOf(field);
    if (field.key === 'pageNumber') return { label, value: pageText(page) };
    const isPerItem = field.source !== 'system' || ITEM_FIELD_KEYS.includes(field.key) || field.key === 'workDetails';
    if (!isPerItem) return { label, value: SYSTEM_VALUES[field.key]?.() || '' };
    if (itemIndex !== undefined) return { label, value: items[itemIndex] ? itemValueOf(field, items[itemIndex], itemIndex) : '' };
    return { label, value: allItemsValueOf(field) };
  };
};
