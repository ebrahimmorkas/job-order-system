// The money side of a job order and the size of a per unit item, worked out
// the same way as the backend (backend/utils/jobOrderTotals.js) so the
// summary updates as the owner types. What is saved is always worked out
// again by the backend.

// Same as the backend (constants/pricingConstants.js).
const MEASUREMENTS_OF = { number: ['length'], area: ['length', 'width'], volume: ['length', 'width', 'height'] };
const SIZE_DECIMALS = 4;

export const roundTo = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

// Up to the next multiple of step (2.3 by 0.5 -> 2.5).
const roundUpTo = (value, step) => (step ? roundTo(Math.ceil(value / step - 1e-9) * step, SIZE_DECIMALS) : value);

/** The measurements a unit takes, in order: ['length'], ['length', 'width'] or all three. */
export const measurementsOf = (measuredAs) => MEASUREMENTS_OF[measuredAs] || MEASUREMENTS_OF.number;

/**
 * The size of one piece of a per unit item.
 * @param {{ measuredAs, roundUpTo, minimumSize, wastagePercent }} unit
 * @param {{ length?, width?, height? }} measurements - numbers; an empty one counts as 1
 * @returns {{ size, chargeableSize, edgeLength }}
 */
export const sizeOf = (unit, measurements) => {
  const names = measurementsOf(unit.measuredAs);
  const raw = names.map((name) => measurements?.[name] ?? 1);
  const rounded = raw.map((value) => roundUpTo(value, unit.roundUpTo));
  const size = roundTo(raw.reduce((product, value) => product * value, 1), SIZE_DECIMALS);
  const withWastage = rounded.reduce((product, value) => product * value, 1) * (1 + (unit.wastagePercent || 0) / 100);
  const chargeableSize = roundTo(Math.max(withWastage, unit.minimumSize || 0), SIZE_DECIMALS);
  const edgeLength = unit.measuredAs === 'area' ? roundTo(2 * (rounded[0] + rounded[1]), SIZE_DECIMALS) : null;
  return { size, chargeableSize, edgeLength };
};

const roundTotal = (value, { step, direction }, decimals) => {
  const scaled = value / step;
  const whole = direction === 'up' ? Math.ceil(scaled - 1e-9) : direction === 'down' ? Math.floor(scaled + 1e-9) : Math.round(scaled + Number.EPSILON);
  return roundTo(whole * step, decimals);
};

/**
 * @param {Object} input
 * @param {Array<{ amount: number, isTaxed: boolean }>} input.prices
 * @param {{ totalRate: number, components: Array<{ label, rate }> }|null} input.tax
 * @param {number} input.decimals
 * @param {string|null} input.interStateLabel - e.g. "IGST" for a sale between two states
 * @param {{ type: 'amount'|'percent', value: number }|null} input.discount - taken off before tax
 * @param {{ step: number, direction: string }|null} input.rounding - how the total is rounded off
 */
export const computeTotals = ({ prices, tax, decimals = 2, interStateLabel = null, discount = null, rounding = null }) => {
  const subtotal = roundTo(prices.reduce((sum, price) => sum + price.amount, 0), decimals);
  const discountAmount = !discount ? 0 : Math.min(subtotal, roundTo(discount.type === 'percent' ? (subtotal * discount.value) / 100 : discount.value, decimals));
  const afterDiscount = roundTo(subtotal - discountAmount, decimals);
  const finish = (taxPart) => {
    const beforeRoundOff = roundTo(afterDiscount + taxPart.taxAmount, decimals);
    const total = rounding ? roundTotal(beforeRoundOff, rounding, decimals) : beforeRoundOff;
    return { subtotal, discountAmount, ...taxPart, roundOff: roundTo(total - beforeRoundOff, decimals), total };
  };
  if (!tax) return finish({ taxableAmount: 0, taxAmount: 0, components: [] });

  const share = subtotal > 0 ? afterDiscount / subtotal : 0;
  const taxableAmount = roundTo(prices.filter((price) => price.isTaxed).reduce((sum, price) => sum + price.amount, 0) * share, decimals);
  const taxAmount = roundTo((taxableAmount * tax.totalRate) / 100, decimals);

  let components = [];
  if (interStateLabel) {
    components = [{ label: interStateLabel, rate: tax.totalRate, amount: taxAmount }];
  } else if (tax.components?.length > 0) {
    let remaining = taxAmount;
    components = tax.components.map((component, index) => {
      const isLast = index === tax.components.length - 1;
      const amount = isLast ? roundTo(remaining, decimals) : roundTo((taxableAmount * component.rate) / 100, decimals);
      remaining = roundTo(remaining - amount, decimals);
      return { label: component.label, rate: component.rate, amount };
    });
  }
  return finish({ taxableAmount, taxAmount, components });
};

/** "₹ 1,680.00" (or a plain number when the currency isn't known). */
export const formatMoney = (amount, currency) => {
  const decimals = currency?.decimalPlaces ?? 2;
  const number = Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return currency?.symbol ? `${currency.symbol} ${number}` : number;
};

/** A size without trailing zeros: 11.25, 10, 0.5. */
export const formatSize = (value) => (value === null || value === undefined ? '' : String(roundTo(value, SIZE_DECIMALS)));
