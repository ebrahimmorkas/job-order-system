// The control types, as the backend names them (constants/controlConstants.js),
// with how the screens describe them.
export const CONTROL_TYPES = {
  textfield: { label: 'Text field', plural: 'Text fields', hint: 'One line of text, e.g. a vehicle number' },
  textarea: { label: 'Text area', plural: 'Text areas', hint: 'Several lines of text, e.g. remarks' },
  checkbox: { label: 'Checkbox', plural: 'Checkboxes', hint: 'One tick box, e.g. "Urgent delivery"' },
  radio: { label: 'Radio buttons', plural: 'Radio groups', hint: 'One choice from a few, e.g. "Are you married?" Yes / No' },
};

export const TEXT_TYPES = ['textfield', 'textarea'];

// Same as the backend. Every other limit is the vendor's own (CompanyMaster).
export const MIN_RADIO_OPTIONS = 2;
// A price text field takes an amount: no minus, at most 2 decimals.
export const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;

// The vendor's limit for this type is reached (null = no limit).
export const isTypeFull = (limits, type) => {
  const allowed = limits?.controlsAllowed?.[type] ?? null;
  return allowed !== null && (limits?.controlsUsed?.[type] ?? 0) >= allowed;
};
