const Joi = require('joi');
const {
    LAYOUT_NAME_MIN_LENGTH, LAYOUT_NAME_MAX_LENGTH, LAYOUT_LIST_MAX_PAGE_SIZE, PAPER_SIZE_VALUES, CUSTOM_PAPER,
    ORIENTATIONS, CUSTOM_PAPER_MIN_MM, CUSTOM_PAPER_MAX_MM, LABEL_DEFAULTS, ELEMENT_TYPES, ELEMENT_TYPE_VALUES, IMAGE_FITS,
    FIELD_SOURCES, FIELD_SOURCE_VALUES, SYSTEM_FIELD_KEYS, FONT_FAMILIES, TEXT_ALIGNS, FONT_SIZE_MIN, FONT_SIZE_MAX,
    STROKE_WIDTH_MAX, ELEMENTS_MAX, TEXT_MAX_LENGTH, LABEL_MAX_LENGTH, TABLE_ROWS_MAX, TABLE_COLS_MAX,
    COLOR_PATTERN, ELEMENT_ID_PATTERN
} = require('../../constants/layoutConstants');
const { MAX_IMAGES_PER_REQUEST } = require('../../constants/storageConstants');

// Whether the masters / controls exist, ids are unique and every element is
// on the page are checked in services/layoutService.js.

const objectId = (label) => Joi.string().hex().length(24).label(label)
    .messages({ 'string.hex': `${label} is invalid`, 'string.length': `${label} is invalid` });

const mm = (label, min = 0) => Joi.number().min(min).max(CUSTOM_PAPER_MAX_MM).precision(2).label(label);
const color = (label) => Joi.string().pattern(COLOR_PATTERN).label(label).messages({ 'string.pattern.base': `${label} must be a colour like #1f2937` });
const onlyFor = (types, schema) => schema.when('type', { is: Joi.valid(...types), then: Joi.optional(), otherwise: Joi.forbidden() });
const requiredFor = (types, schema) => schema.when('type', { is: Joi.valid(...types), then: Joi.required(), otherwise: Joi.forbidden() });

// Text formatting - kept only while isControlFeatureInLayoutOn is on.
const style = Joi.object({
    fontFamily: Joi.string().valid(...FONT_FAMILIES),
    fontSize: Joi.number().min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).precision(1),
    bold: Joi.boolean(),
    italic: Joi.boolean(),
    underline: Joi.boolean(),
    align: Joi.string().valid(...TEXT_ALIGNS),
    color: color('Text colour')
}).label('Text style');

// A master, a control or a job order / company field. showLabel: "xyz: b"
// instead of "b"; labelText replaces the label shown.
const fieldRef = Joi.object({
    source: Joi.string().valid(...FIELD_SOURCE_VALUES).required().label('Field source'),
    refId: objectId('Field').when('source', { is: Joi.valid(FIELD_SOURCES.MASTER, FIELD_SOURCES.CONTROL), then: Joi.required(), otherwise: Joi.forbidden() }),
    key: Joi.string().valid(...SYSTEM_FIELD_KEYS).when('source', { is: FIELD_SOURCES.SYSTEM, then: Joi.required(), otherwise: Joi.forbidden() }).label('Field'),
    showLabel: Joi.boolean().default(false),
    labelText: Joi.string().trim().max(LABEL_MAX_LENGTH).allow('', null).empty(['', null]).default(null).label('Label text')
}).label('Field');

const stroke = Joi.object({
    color: color('Line colour').default('#111827'),
    width: Joi.number().min(0).max(STROKE_WIDTH_MAX).precision(2).default(1).label('Line width'),
    dashed: Joi.boolean().default(false)
}).label('Line');

// rows x cols cells, each typed text or a field; colWidths are shares of the width.
const table = Joi.object({
    rows: Joi.number().integer().min(1).max(TABLE_ROWS_MAX).required().label('Rows'),
    cols: Joi.number().integer().min(1).max(TABLE_COLS_MAX).required().label('Columns'),
    colWidths: Joi.array().items(Joi.number().min(1).max(100)).max(TABLE_COLS_MAX).required().label('Column widths'),
    cells: Joi.array().items(Joi.array().items(Joi.object({
        text: Joi.string().max(TEXT_MAX_LENGTH).allow('').default(''),
        field: fieldRef.allow(null).default(null)
    })).max(TABLE_COLS_MAX)).max(TABLE_ROWS_MAX).required().label('Cells')
}).custom((value, helpers) => {
    const fits = value.colWidths.length === value.cols && value.cells.length === value.rows && value.cells.every((row) => row.length === value.cols);
    return fits ? value : helpers.message('The table\'s cells do not match its rows and columns');
}).label('Table');

const element = Joi.object({
    id: Joi.string().pattern(ELEMENT_ID_PATTERN).required().label('Element id'),
    type: Joi.string().valid(...ELEMENT_TYPE_VALUES).required().label('Element type'),
    x: mm('X').required(),
    y: mm('Y').required(),
    width: mm('Width', 0.5).required(),
    height: mm('Height', 0.5).required(),
    field: requiredFor([ELEMENT_TYPES.FIELD], fieldRef),
    text: requiredFor([ELEMENT_TYPES.TEXT], Joi.string().max(TEXT_MAX_LENGTH).allow('').label('Text')),
    style: onlyFor([ELEMENT_TYPES.FIELD, ELEMENT_TYPES.TEXT, ELEMENT_TYPES.TABLE], style),
    stroke: onlyFor([ELEMENT_TYPES.LINE, ELEMENT_TYPES.RECTANGLE, ELEMENT_TYPES.CIRCLE, ELEMENT_TYPES.TABLE], stroke),
    direction: onlyFor([ELEMENT_TYPES.LINE], Joi.string().valid('horizontal', 'vertical')),
    fill: onlyFor([ELEMENT_TYPES.RECTANGLE, ELEMENT_TYPES.CIRCLE], color('Fill colour').allow(null)),
    radius: onlyFor([ELEMENT_TYPES.RECTANGLE], Joi.number().min(0).max(100).precision(2).label('Corner radius')),
    table: requiredFor([ELEMENT_TYPES.TABLE], table),
    imageNumber: requiredFor([ELEMENT_TYPES.IMAGE], Joi.number().integer().min(1).max(MAX_IMAGES_PER_REQUEST).label('Image number')),
    // 'contain' when left out (the service sets it).
    fit: onlyFor([ELEMENT_TYPES.IMAGE], Joi.string().valid(...IMAGE_FITS).label('Image fit'))
}).label('Element');

const paper = Joi.object({
    size: Joi.string().valid(...PAPER_SIZE_VALUES).required().label('Paper size'),
    orientation: Joi.string().valid(...ORIENTATIONS).default('portrait').label('Orientation'),
    // Typed in for a custom size; worked out by the service for a named one.
    widthMm: Joi.number().min(CUSTOM_PAPER_MIN_MM).max(CUSTOM_PAPER_MAX_MM).precision(1).label('Width')
        .when('size', { is: CUSTOM_PAPER, then: Joi.required() }),
    heightMm: Joi.number().min(CUSTOM_PAPER_MIN_MM).max(CUSTOM_PAPER_MAX_MM).precision(1).label('Height')
        .when('size', { is: CUSTOM_PAPER, then: Joi.required() })
}).required().label('Paper');

const layoutBody = {
    name: Joi.string().trim().min(LAYOUT_NAME_MIN_LENGTH).max(LAYOUT_NAME_MAX_LENGTH).required().label('Name'),
    paper,
    labelDefault: Joi.string().valid(...LABEL_DEFAULTS).default('none').label('Show labels'),
    elements: Joi.array().items(element).max(ELEMENTS_MAX).default([]).label('Elements')
        .messages({ 'array.max': `A layout can have at most ${ELEMENTS_MAX} items` })
};

const layoutIdParamSchema = Joi.object({
    id: objectId('Layout id').required()
});

// GET /api/layouts
const listLayoutsQuerySchema = Joi.object({
    search: Joi.string().trim().max(LAYOUT_NAME_MAX_LENGTH).allow('').default('').label('Search'),
    status: Joi.string().valid('A', 'I').label('Status'),
    page: Joi.number().integer().min(1).default(1).label('Page'),
    limit: Joi.number().integer().min(1).max(LAYOUT_LIST_MAX_PAGE_SIZE).default(25).label('Limit')
});

// POST /api/layouts, PUT /api/layouts/:id
const layoutSchema = Joi.object(layoutBody);

// PATCH /api/layouts/:id/status
const statusSchema = Joi.object({
    isActive: Joi.boolean().required().label('isActive')
});

// POST /api/layouts/bulk
const bulkLayoutsSchema = Joi.object({
    action: Joi.string().valid('activate', 'deactivate', 'delete').required().label('Action'),
    ids: Joi.array().items(objectId('Layout id')).min(1).max(LAYOUT_LIST_MAX_PAGE_SIZE).unique().required().label('Layouts')
});

module.exports = {
    layoutIdParamSchema,
    listLayoutsQuerySchema,
    layoutSchema,
    statusSchema,
    bulkLayoutsSchema
};
