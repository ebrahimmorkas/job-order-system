// The items of a job order (each with its job name, masters, controls,
// images and work). Same as the backend (utils/jobOrderItems.js).

import { PRICE_PATTERN, QUANTITY_PATTERN, MEASUREMENT_PATTERN } from '../controls/controlTypes';
import { roundTo, sizeOf } from './jobOrderTotals';

// Same as the backend (constants/jobOrderConstants.js).
export const JOB_NAME_MAX_LENGTH = 100;
export const RATE_TIMES_QUANTITY = 'rateTimesQuantity';

/**
 * What an item is called: "Item 2 · Square glass" (or "Item 2") when the job
 * order has several items, else its job name ('' without one).
 */
export const itemLabelOf = (item, index, count) => {
  if (count > 1) return `Item ${index + 1}${item.name ? ` · ${item.name}` : ''}`;
  return item.name || '';
};

/**
 * Whether a control is asked on an item ("Show only when", same as the
 * backend utils/jobOrderItems.js): always without a tag, or when its master
 * isn't on the form; else when a value of that master is picked on the item
 * (any value, or one of the tagged ones).
 * @param {Array<{ _id }>} masters - The form's masters
 * @param {Object<string, string[]>} picks - masterId -> the value ids picked on the item
 */
export const isControlShown = (control, masters, picks) => {
  const tag = control.showWhen;
  if (!tag) return true;
  if (!masters.some((master) => master._id === tag.masterId)) return true;
  const picked = picks[tag.masterId] || [];
  return tag.valueIds.length === 0 ? picked.length > 0 : picked.some((valueId) => tag.valueIds.includes(valueId));
};

/** The controls asked on an item, in order (isControlShown). */
export const shownControlsOf = ({ controls, masters }, item) => controls.filter((control) => isControlShown(control, masters, item.picks));

/** The vendor's quantity control (a text field ticked as the quantity), or undefined. */
export const quantityControlOf = (controls) => controls.find((control) => control.type === 'textfield' && control.isQuantity);

/** An item's quantity on the form: the quantity control's answer, else 1 (same as the backend). */
export const quantityOf = (controls, answers) => {
  const control = quantityControlOf(controls);
  const text = control ? answers[control._id].text.trim() : '';
  return QUANTITY_PATTERN.test(text) ? Number(text) : 1;
};

/**
 * Rate x what it is multiplied by (the quantity, times the size / edge on a
 * per unit item) of a typed rate, or null when the rate isn't an amount.
 */
export const workedTotalOf = (rateText, times) => {
  const rate = rateText.trim();
  return PRICE_PATTERN.test(rate) ? roundTo(Number(rate) * times, 2) : null;
};

/**
 * A price's amount on the form, or null when it isn't a valid amount yet.
 * Rate x quantity (x size): the total typed by hand, else worked out.
 */
export const priceAmountOf = (answer, times, isRateTimesQuantity) => {
  if (!isRateTimesQuantity) return PRICE_PATTERN.test(answer.text.trim()) ? Number(answer.text.trim()) : null;
  if (answer.isTotalEdited) return PRICE_PATTERN.test(answer.total.trim()) ? Number(answer.total.trim()) : null;
  return workedTotalOf(answer.text, times);
};

/** The unit dropdown (per unit pricing on), or undefined. */
export const unitControlOf = (controls) => controls.find((control) => control.type === 'dropdown' && control.isUnit);

// A typed measurement as a number (empty or not a number yet = 1, as the backend counts an empty one).
const measurementOf = (text) => (text && MEASUREMENT_PATTERN.test(text.trim()) && Number(text) > 0 ? Number(text) : null);

/**
 * How an item is charged on the form: null per piece (or without per unit
 * pricing); per unit: the unit dropdown, the unit picked (null = not yet) and
 * its size ({ size, chargeableSize, edgeLength }, null without a unit).
 */
export const itemPricingOf = (controls, item, isPerRateOn) => {
  const unitControl = isPerRateOn ? unitControlOf(controls) : undefined;
  if (!unitControl || item.chargeBy !== 'unit') return null;
  const unit = unitControl.options.find((option) => option._id === item.answers[unitControl._id]?.optionId) || null;
  const measurements = Object.fromEntries(Object.entries(item.measurements).map(([name, text]) => [name, measurementOf(text)]));
  return { unitControl, unit, size: unit ? sizeOf(unit, measurements) : null };
};

/**
 * How a price is charged on an item: { chargedBy, factor } - chargedBy null
 * per piece items; factor: what the rate is multiplied by besides the quantity.
 * Same as the backend (services/jobOrderService.js chargeOf).
 */
export const chargeOf = (control, pricing) => {
  if (!pricing?.size) return { chargedBy: null, factor: 1 };
  let chargedBy = control.chargedBy || 'unit';
  if (chargedBy === 'edge' && pricing.size.edgeLength === null) chargedBy = 'unit';
  const factor = chargedBy === 'piece' ? 1 : chargedBy === 'edge' ? pricing.size.edgeLength : pricing.size.chargeableSize;
  return { chargedBy, factor };
};
