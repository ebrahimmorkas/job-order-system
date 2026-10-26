// Layout Master (models/Layout.js): print layouts for job orders. Shared by
// the model, the Joi validations and the service so they can never disagree.
// Every size is in millimetres; font sizes in points.

const LAYOUT_NAME_MIN_LENGTH = 2;
const LAYOUT_NAME_MAX_LENGTH = 50;
const LAYOUT_LIST_MAX_PAGE_SIZE = 100;

// Portrait width x height.
const PAPER_SIZES = {
    A3: { label: 'A3', widthMm: 297, heightMm: 420 },
    A4: { label: 'A4', widthMm: 210, heightMm: 297 },
    A5: { label: 'A5', widthMm: 148, heightMm: 210 },
    Letter: { label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
    Legal: { label: 'Legal', widthMm: 215.9, heightMm: 355.6 }
};
const CUSTOM_PAPER = 'custom';
const PAPER_SIZE_VALUES = [...Object.keys(PAPER_SIZES), CUSTOM_PAPER];
const ORIENTATIONS = ['portrait', 'landscape'];
const CUSTOM_PAPER_MIN_MM = 50;
const CUSTOM_PAPER_MAX_MM = 1500;

// Which dropped fields show their label ("xyz: b") by default; each element
// can still be switched on / off.
const LABEL_DEFAULTS = ['none', 'masters', 'controls', 'both'];

const ELEMENT_TYPES = {
    FIELD: 'field',
    TEXT: 'text',
    LINE: 'line',
    RECTANGLE: 'rectangle',
    CIRCLE: 'circle',
    TABLE: 'table',
    LOGO: 'logo',
    // One of the job order's own images: imageNumber 1 = its first image.
    IMAGE: 'image'
};
// How a job order image sits in its box: all of it inside, or filling the box.
const IMAGE_FITS = ['contain', 'cover'];
const ELEMENT_TYPE_VALUES = Object.values(ELEMENT_TYPES);

// Where a field's value comes from: a master, a control, or the job order /
// company itself (SYSTEM_FIELDS).
const FIELD_SOURCES = { MASTER: 'master', CONTROL: 'control', SYSTEM: 'system' };
const FIELD_SOURCE_VALUES = Object.values(FIELD_SOURCES);
const SYSTEM_FIELDS = {
    jobOrderNumber: 'Job order number',
    jobOrderDate: 'Date',
    deliveryDate: 'Delivery date',
    customerName: 'Customer name',
    customerPhone: 'Customer phone',
    customerEmail: 'Customer email',
    customerAddress: 'Customer address',
    subtotal: 'Subtotal',
    // The amount taken off, with the % when given as one: "50.00 (10%)".
    discount: 'Discount',
    taxSummary: 'Tax',
    total: 'Total',
    advance: 'Advance',
    balance: 'Balance',
    companyName: 'Company name',
    companyAddress: 'Company address',
    companyTaxIds: 'Company tax numbers',
    // Every value's work: who, step, start and due (Company Settings says which).
    workDetails: 'Work given',
    // "Page 1 of 2" - for a header or footer.
    pageNumber: 'Page number',
    // One item's own details (ITEM_FIELD_KEYS): in a table row repeated for
    // each item, the value of that item; elsewhere every item's, one per line.
    itemNumber: 'Item no.',
    itemName: 'Job order name',
    itemQuantity: 'Quantity',
    itemSize: 'Size',
    itemAmount: 'Item amount',
    // The item amount divided by its quantity.
    itemUnitPrice: 'Price for one'
};
const SYSTEM_FIELD_KEYS = Object.keys(SYSTEM_FIELDS);
const ITEM_FIELD_KEYS = ['itemNumber', 'itemName', 'itemQuantity', 'itemSize', 'itemAmount', 'itemUnitPrice'];

// Which lines a table draws: every cell, only its outside, only across
// (between rows), or none.
const TABLE_LINES = ['all', 'outside', 'rows', 'none'];
// The header (top) and footer (bottom) bands repeat on every printed page;
// between them at least this much is left for the rest.
const BODY_MIN_MM = 20;

const FONT_FAMILIES = ['sans', 'serif', 'mono'];
const TEXT_ALIGNS = ['left', 'center', 'right'];
const FONT_SIZE_MIN = 6;
const FONT_SIZE_MAX = 72;
const STROKE_WIDTH_MAX = 10;
const ELEMENTS_MAX = 300;
// Pages added after the job order's own (each prints once).
const EXTRA_PAGES_MAX = 10;
const TEXT_MAX_LENGTH = 1000;
const LABEL_MAX_LENGTH = 60;
const TABLE_ROWS_MAX = 30;
const TABLE_COLS_MAX = 10;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
// Ids the designer gives elements (and table cells).
const ELEMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

module.exports = {
    LAYOUT_NAME_MIN_LENGTH,
    LAYOUT_NAME_MAX_LENGTH,
    LAYOUT_LIST_MAX_PAGE_SIZE,
    PAPER_SIZES,
    CUSTOM_PAPER,
    PAPER_SIZE_VALUES,
    ORIENTATIONS,
    CUSTOM_PAPER_MIN_MM,
    CUSTOM_PAPER_MAX_MM,
    LABEL_DEFAULTS,
    ELEMENT_TYPES,
    IMAGE_FITS,
    ELEMENT_TYPE_VALUES,
    FIELD_SOURCES,
    FIELD_SOURCE_VALUES,
    SYSTEM_FIELDS,
    SYSTEM_FIELD_KEYS,
    ITEM_FIELD_KEYS,
    TABLE_LINES,
    BODY_MIN_MM,
    FONT_FAMILIES,
    TEXT_ALIGNS,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    STROKE_WIDTH_MAX,
    ELEMENTS_MAX,
    EXTRA_PAGES_MAX,
    TEXT_MAX_LENGTH,
    LABEL_MAX_LENGTH,
    TABLE_ROWS_MAX,
    TABLE_COLS_MAX,
    COLOR_PATTERN,
    ELEMENT_ID_PATTERN
};
