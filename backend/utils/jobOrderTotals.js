// The money side of a job order: subtotal, tax and total. The frontend has the
// same function (features/jobOrders/jobOrderTotals.js) to show the summary as
// the owner types; the saved numbers always come from this one.

const roundTo = (value, decimals) => {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
};

/**
 * @param {Object} input
 * @param {Array<{ amount: number, isTaxed: boolean }>} input.prices - every price on the job order
 * @param {{ totalRate: number, components: Array<{ label, rate }> }|null} input.tax - the rate charged, or null for none
 * @param {number} input.decimals - the currency's decimal places
 * @param {string|null} input.interStateLabel - set (e.g. "IGST") when the sale is between two states:
 *   the tax is then shown as that one tax instead of the rate's split
 * @returns {{ subtotal, taxableAmount, taxAmount, components: Array<{ label, rate, amount }>, total }}
 */
const computeTotals = ({ prices, tax, decimals = 2, interStateLabel = null }) => {
    try {
        const subtotal = roundTo(prices.reduce((sum, price) => sum + price.amount, 0), decimals);
        if (!tax) return { subtotal, taxableAmount: 0, taxAmount: 0, components: [], total: subtotal };

        const taxableAmount = roundTo(prices.filter((price) => price.isTaxed).reduce((sum, price) => sum + price.amount, 0), decimals);
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

        return { subtotal, taxableAmount, taxAmount, components, total: roundTo(subtotal + taxAmount, decimals) };
    } catch (err) {
        throw err;
    }
};

module.exports = {
    roundTo,
    computeTotals
};
