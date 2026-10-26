// The control types, as the backend names them (constants/controlConstants.js),
// with how the screens describe them.
export const CONTROL_TYPES = {
  textfield: { label: 'Text field', plural: 'Text fields', hint: 'One line of text, e.g. a vehicle number' },
  textarea: { label: 'Text area', plural: 'Text areas', hint: 'Several lines of text, e.g. remarks' },
  checkbox: { label: 'Checkbox', plural: 'Checkboxes', hint: 'One tick box, e.g. "Urgent delivery"' },
  radio: { label: 'Radio buttons', plural: 'Radio groups', hint: 'One choice from a few, e.g. "Are you married?" Yes / No' },
  dropdown: { label: 'Dropdown', plural: 'Dropdowns', hint: 'One choice from a list, e.g. Colour: Red / Blue / Green' },
};

// Controls whose answer is one of their choices.
export const CHOICE_TYPES = ['radio', 'dropdown'];

export const TEXT_TYPES = ['textfield', 'textarea'];

// Same as the backend. Every other limit is the vendor's own (CompanyMaster).
export const MIN_RADIO_OPTIONS = 2;
// A price text field takes an amount: no minus, at most 2 decimals.
export const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
// A quantity text field takes a whole number from 1 to 999999.
export const QUANTITY_PATTERN = /^[1-9]\d{0,5}$/;

// Per unit pricing - same as the backend (constants/pricingConstants.js).
// How a unit (a choice of the unit dropdown) is measured.
export const MEASURED_AS = [
  { value: 'number', label: 'One number', hint: 'e.g. meter, kg, hour', measurements: ['length'] },
  { value: 'area', label: 'Length × Width', hint: 'e.g. sq ft, sq m', measurements: ['length', 'width'] },
  { value: 'volume', label: 'Length × Width × Height', hint: 'e.g. cubic ft', measurements: ['length', 'width', 'height'] },
];
// Each measurement rounded up to one of these steps ('' = not rounded).
export const ROUND_UP_STEPS = [0.25, 0.5, 1];
// A measurement (or minimum size): at most 6 digits and 3 decimals.
export const MEASUREMENT_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;
// Wastage: a % from 0 to 100, at most 2 decimals.
export const WASTAGE_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
// How a price is charged on a per unit item.
export const PRICE_CHARGED = [
  { value: 'unit', label: 'Per unit', description: 'Rate × size × quantity, e.g. glass at ₹100 per sq ft.' },
  { value: 'edge', label: 'Per running length of the edge', description: 'Rate × 2 × (length + width) × quantity, e.g. edge polishing per running ft. Only for units measured as Length × Width; otherwise per unit.' },
  { value: 'piece', label: 'Per piece', description: 'Rate × quantity, whatever the size, e.g. a hole.' },
];

// The vendor's limit for this type is reached (null = no limit).
export const isTypeFull = (limits, type) => {
  const allowed = limits?.controlsAllowed?.[type] ?? null;
  return allowed !== null && (limits?.controlsUsed?.[type] ?? 0) >= allowed;
};
