// Per unit pricing (feature isPerRatePricingFeatureOn) and the money extras of
// a job order (discount, round off, advance). Shared by the models, the Joi
// validations and the services so they can never disagree. The frontend has
// the same values (features/jobOrders/pricing.js).

// How an item is charged (CompanySettings.chargeBy is the default of a new
// item; each item can change it): per piece - every price is rate x quantity;
// per unit - a price is rate x the item's size (sq ft, meter...) x quantity.
const CHARGE_BY = {
    PIECE: 'piece',
    UNIT: 'unit'
};
const CHARGE_BY_VALUES = Object.values(CHARGE_BY);

// How one price control is charged on a per unit item (Control.chargedBy):
// per piece (rate x quantity), per unit (rate x size x quantity) or per
// running length of the edge (rate x 2 x (length + width) x quantity; area
// units only - with other units it is charged per unit).
const PRICE_CHARGED = {
    PIECE: 'piece',
    UNIT: 'unit',
    EDGE: 'edge'
};
const PRICE_CHARGED_VALUES = Object.values(PRICE_CHARGED);

// How a unit (a choice of the unit dropdown) is measured: one number (meter,
// kg, hour), length x width (sq ft, sq m) or length x width x height (cubic ft).
const MEASURED_AS = {
    NUMBER: 'number',
    AREA: 'area',
    VOLUME: 'volume'
};
const MEASURED_AS_VALUES = Object.values(MEASURED_AS);
// The measurements each way takes, in order.
const MEASUREMENTS_OF = {
    [MEASURED_AS.NUMBER]: ['length'],
    [MEASURED_AS.AREA]: ['length', 'width'],
    [MEASURED_AS.VOLUME]: ['length', 'width', 'height']
};

// Each measurement rounded up to a step of this size (none when not set).
const ROUND_UP_STEPS = [0.25, 0.5, 1];
// A measurement: more than 0, at most 6 digits and 3 decimals (10, 2.5, 12.125).
const MEASUREMENT_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;
// Wastage added to the size, in % (at most 2 decimals).
const WASTAGE_MAX = 100;
// Decimals kept of a size (the chargeable size, the edge).
const SIZE_DECIMALS = 4;

// Discount on a job order: an amount or a % of the subtotal (taken before tax).
const DISCOUNT_TYPES = {
    AMOUNT: 'amount',
    PERCENT: 'percent'
};
const DISCOUNT_TYPE_VALUES = Object.values(DISCOUNT_TYPES);

// Round off of the total (CompanySettings.roundTotalTo - null = none) and which way.
const ROUND_TOTAL_STEPS = [1, 5, 10];
const ROUND_TOTAL_DIRECTIONS = {
    NEAREST: 'nearest',
    UP: 'up',
    DOWN: 'down'
};
const ROUND_TOTAL_DIRECTION_VALUES = Object.values(ROUND_TOTAL_DIRECTIONS);

module.exports = {
    CHARGE_BY,
    CHARGE_BY_VALUES,
    PRICE_CHARGED,
    PRICE_CHARGED_VALUES,
    MEASURED_AS,
    MEASURED_AS_VALUES,
    MEASUREMENTS_OF,
    ROUND_UP_STEPS,
    MEASUREMENT_PATTERN,
    WASTAGE_MAX,
    SIZE_DECIMALS,
    DISCOUNT_TYPES,
    DISCOUNT_TYPE_VALUES,
    ROUND_TOTAL_STEPS,
    ROUND_TOTAL_DIRECTIONS,
    ROUND_TOTAL_DIRECTION_VALUES
};
