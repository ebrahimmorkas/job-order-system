// The money side of a job order: subtotal, discount, tax, round off and
// total, and the size of a per unit item. The frontend has the same functions
// (features/jobOrders/jobOrderTotals.js) to show the summary as the owner
// types; the saved numbers always come from these.

const { MEASURED_AS, MEASUREMENTS_OF, DISCOUNT_TYPES, ROUND_TOTAL_DIRECTIONS, SIZE_DECIMALS } = require('../constants/pricingConstants');

const roundTo = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
};

// Up to the next multiple of step (2.3 by 0.5 -> 2.5); a tiny epsilon keeps
// 2.5 at 2.5.
const roundUpTo = (value, step) => {
    if (!step) return value;
    return roundTo(Math.ceil(value / step - 1e-9) * step, SIZE_DECIMALS);
};

/**
 * The size of one piece of a per unit item.
 * @param {{ measuredAs: string, roundUpTo: number|null, minimumSize: number|null, wastagePercent: number|null }} unit
 * @param {{ length?: number|null, width?: number|null, height?: number|null }} measurements - an empty one counts as 1
 * @returns {{ size, chargeableSize, edgeLength }} size: as measured; chargeableSize: each
 *   measurement rounded up, then the wastage added, at least the minimum; edgeLength:
 *   2 x (length + width) of the rounded measurements (area units only, else null)
 */
const sizeOf = (unit, measurements) => {
    try {
        const names = MEASUREMENTS_OF[unit.measuredAs] || MEASUREMENTS_OF[MEASURED_AS.NUMBER];
        const raw = names.map((name) => measurements?.[name] ?? 1);
        const rounded = raw.map((value) => roundUpTo(value, unit.roundUpTo));
        const size = roundTo(raw.reduce((product, value) => product * value, 1), SIZE_DECIMALS);
        const withWastage = rounded.reduce((product, value) => product * value, 1) * (1 + (unit.wastagePercent || 0) / 100);
        const chargeableSize = roundTo(Math.max(withWastage, unit.minimumSize || 0), SIZE_DECIMALS);
        const edgeLength = unit.measuredAs === MEASURED_AS.AREA ? roundTo(2 * (rounded[0] + rounded[1]), SIZE_DECIMALS) : null;
        return { size, chargeableSize, edgeLength };
    } catch (err) {
        throw err;
    }
};

// The total rounded to a step (1, 5, 10) the way the vendor chose.
const roundTotal = (value, { step, direction }, decimals) => {
    const scaled = value / step;
    const whole = direction === ROUND_TOTAL_DIRECTIONS.UP ? Math.ceil(scaled - 1e-9)
        : direction === ROUND_TOTAL_DIRECTIONS.DOWN ? Math.floor(scaled + 1e-9)
            : Math.round(scaled + Number.EPSILON);
    return roundTo(whole * step, decimals);
};

/**
 * @param {Object} input
 * @param {Array<{ amount: number, isTaxed: boolean }>} input.prices - every price on the job order
 * @param {{ totalRate: number, components: Array<{ label, rate }> }|null} input.tax - the rate charged, or null for none
 * @param {number} input.decimals - the currency's decimal places
 * @param {string|null} input.interStateLabel - set (e.g. "IGST") when the sale is between two states:
 *   the tax is then shown as that one tax instead of the rate's split
 * @param {{ type: 'amount'|'percent', value: number }|null} input.discount - taken off the
 *   subtotal before tax (the taxed prices get their share of it); at most the subtotal
 * @param {{ step: number, direction: string }|null} input.rounding - how the total is rounded off
 * @returns {{ subtotal, discountAmount, taxableAmount, taxAmount, components: Array<{ label, rate, amount }>, roundOff, total }}
 */
const computeTotals = ({ prices, tax, decimals = 2, interStateLabel = null, discount = null, rounding = null }) => {
    try {
        const subtotal = roundTo(prices.reduce((sum, price) => sum + price.amount, 0), decimals);
        const discountAmount = !discount ? 0 : Math.min(subtotal, roundTo(discount.type === DISCOUNT_TYPES.PERCENT ? (subtotal * discount.value) / 100 : discount.value, decimals));
        const afterDiscount = roundTo(subtotal - discountAmount, decimals);
        const finish = (taxPart) => {
            const beforeRoundOff = roundTo(afterDiscount + taxPart.taxAmount, decimals);
            const total = rounding ? roundTotal(beforeRoundOff, rounding, decimals) : beforeRoundOff;
            return { subtotal, discountAmount, ...taxPart, roundOff: roundTo(total - beforeRoundOff, decimals), total };
        };
        if (!tax) return finish({ taxableAmount: 0, taxAmount: 0, components: [] });

        // The taxed prices keep their share of what is left after the discount.
        const share = subtotal > 0 ? afterDiscount / subtotal : 0;
        const taxableAmount = roundTo(prices.filter((price) => price.isTaxed).reduce((sum, price) => sum + price.amount, 0) * share, decimals);
        const taxAmount = roundTo((taxableAmount * tax.totalRate) / 100, decimals);

        let components = [];
        if (interStateLabel) {
            components = [{ label: interStateLabel, rate: tax.totalRate, amount: taxAmount }];
        } else if (tax.components?.length > 0) {
            // Each part rounded on its own; the last one takes the rounding
            // difference, so the parts always add up to the tax.
            let remaining = taxAmount;
            components = tax.components.map((component, index) => {
                const isLast = index === tax.components.length - 1;
                const amount = isLast ? roundTo(remaining, decimals) : roundTo((taxableAmount * component.rate) / 100, decimals);
                remaining = roundTo(remaining - amount, decimals);
                return { label: component.label, rate: component.rate, amount };
            });
        }

        return finish({ taxableAmount, taxAmount, components });
    } catch (err) {
        throw err;
    }
};

module.exports = {
    roundTo,
    roundUpTo,
    sizeOf,
    computeTotals
};
