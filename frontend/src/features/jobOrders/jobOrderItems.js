// The items of a job order (each with its job name, masters, controls,
// images and work). Same as the backend (utils/jobOrderItems.js).

import { PRICE_PATTERN, QUANTITY_PATTERN } from '../controls/controlTypes';
import { roundTo } from './jobOrderTotals';

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

/** The vendor's quantity control (a text field ticked as the quantity), or undefined. */
export const quantityControlOf = (controls) => controls.find((control) => control.type === 'textfield' && control.isQuantity);

/** An item's quantity on the form: the quantity control's answer, else 1 (same as the backend). */
export const quantityOf = (controls, answers) => {
  const control = quantityControlOf(controls);
  const text = control ? answers[control._id].text.trim() : '';
  return QUANTITY_PATTERN.test(text) ? Number(text) : 1;
};

/** Rate x quantity of a typed rate, or null when the rate isn't an amount. */
export const workedTotalOf = (rateText, quantity) => {
  const rate = rateText.trim();
  return PRICE_PATTERN.test(rate) ? roundTo(Number(rate) * quantity, 2) : null;
};

/**
 * A price's amount on the form, or null when it isn't a valid amount yet.
 * Rate x quantity: the total typed by hand, else rate x quantity.
 */
export const priceAmountOf = (answer, quantity, isRateTimesQuantity) => {
  if (!isRateTimesQuantity) return PRICE_PATTERN.test(answer.text.trim()) ? Number(answer.text.trim()) : null;
  if (answer.isTotalEdited) return PRICE_PATTERN.test(answer.total.trim()) ? Number(answer.total.trim()) : null;
  return workedTotalOf(answer.text, quantity);
};
