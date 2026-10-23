import { formatMoney } from '../jobOrders/jobOrderTotals';
import { customerLineOf, masterLabelOf } from '../jobOrders/summaryRows';

// What a field on a layout shows: { label, value }. In the designer the value
// is a placeholder ("[Cutting]"); printing a job order fills in its values.

const SYSTEM_LABELS = {
  jobOrderNumber: 'Job order number',
  jobOrderDate: 'Date',
  customerAddress: 'Customer address',
  subtotal: 'Subtotal',
  taxSummary: 'Tax',
  total: 'Total',
  companyName: 'Company name',
  companyAddress: 'Company address',
  companyTaxIds: 'Company tax numbers',
};

const byId = (docs) => new Map((docs || []).map((doc) => [doc._id, doc]));

/** The text of a field: "label: value", or the value alone. */
export const fieldText = (field, { label, value }) => {
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
  return (field) => {
    let label;
    if (field.source === 'master') label = masterById.get(field.refId)?.name;
    else if (field.source === 'control') label = controlById.get(field.refId)?.label;
    else label = systemByKey.get(field.key) || SYSTEM_LABELS[field.key];
    return label ? { label, value: `[${label}]` } : { label: 'Removed', value: '[removed]', isMissing: true };
  };
};

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/**
 * A job order's real values.
 * @param {Object} jobOrder - As saved (models/JobOrder.js)
 * @param {{ masters, controls, company: { name, byCountry }, settings: { useShortNames } }} printData
 */
export const jobOrderResolver = (jobOrder, { masters, controls, company, settings }) => {
  const masterNames = byId(masters);
  const controlNames = byId(controls);
  const pickedById = new Map(jobOrder.masters.map((m) => [m.masterId, m]));
  const answerById = new Map(jobOrder.controls.map((c) => [c.controlId, c]));
  const money = (amount) => formatMoney(amount, jobOrder.currency);
  const countryId = jobOrder.tax?.countryId || jobOrder.customer?.countryId || Object.keys(company.byCountry || {})[0];
  const companyHere = company.byCountry?.[countryId] || { address: '', taxIds: [] };

  const SYSTEM_VALUES = {
    jobOrderNumber: () => jobOrder.jobOrderNumber,
    jobOrderDate: () => formatDate(jobOrder.createdAt),
    customerAddress: () => customerLineOf(jobOrder.customer),
    subtotal: () => money(jobOrder.subtotal),
    taxSummary: () => (jobOrder.tax?.isApplied ? jobOrder.tax.components.map((c) => `${c.label} ${c.rate}%: ${money(c.amount)}`).join('\n') : ''),
    total: () => money(jobOrder.total),
    companyName: () => company.name,
    companyAddress: () => companyHere.address,
    companyTaxIds: () => companyHere.taxIds.map((t) => `${t.label}: ${t.value}`).join('\n'),
  };

  return (field) => {
    if (field.source === 'master') {
      const picked = pickedById.get(field.refId);
      const named = picked || masterNames.get(field.refId);
      return {
        label: named ? masterLabelOf(named, settings.useShortNames) : '',
        value: picked ? picked.values.map((v) => v.name).join(', ') : '',
      };
    }
    if (field.source === 'control') {
      const answer = answerById.get(field.refId);
      const label = answer?.label || controlNames.get(field.refId)?.label || '';
      if (!answer) return { label, value: '' };
      if (answer.isPrice) return { label, value: answer.amount === null ? '' : money(answer.amount) };
      if (answer.type === 'checkbox') return { label, value: answer.checked === null ? '' : (answer.checked ? 'Yes' : 'No') };
      if (answer.type === 'radio') return { label, value: answer.optionName || '' };
      return { label, value: answer.text || '' };
    }
    return { label: SYSTEM_LABELS[field.key], value: SYSTEM_VALUES[field.key]?.() || '' };
  };
};
