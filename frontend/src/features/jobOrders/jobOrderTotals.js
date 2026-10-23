// The money side of a job order, worked out the same way as the backend
// (backend/utils/jobOrderTotals.js) so the summary updates as the owner
// types. What is saved is always worked out again by the backend.

export const roundTo = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * @param {Object} input
 * @param {Array<{ amount: number, isTaxed: boolean }>} input.prices
 * @param {{ totalRate: number, components: Array<{ label, rate }> }|null} input.tax
 * @param {number} input.decimals
 * @param {string|null} input.interStateLabel - e.g. "IGST" for a sale between two states
 */
export const computeTotals = ({ prices, tax, decimals = 2, interStateLabel = null }) => {
  const subtotal = roundTo(prices.reduce((sum, price) => sum + price.amount, 0), decimals);
  if (!tax) return { subtotal, taxableAmount: 0, taxAmount: 0, components: [], total: subtotal };

  const taxableAmount = roundTo(prices.filter((price) => price.isTaxed).reduce((sum, price) => sum + price.amount, 0), decimals);
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
  return { subtotal, taxableAmount, taxAmount, components, total: roundTo(subtotal + taxAmount, decimals) };
};

/** "₹ 1,680.00" (or a plain number when the currency isn't known). */
export const formatMoney = (amount, currency) => {
  const decimals = currency?.decimalPlaces ?? 2;
  const number = Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return currency?.symbol ? `${currency.symbol} ${number}` : number;
};
