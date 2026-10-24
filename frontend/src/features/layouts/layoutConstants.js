// Same rules as the backend (constants/layoutConstants.js). Everything on a
// layout is in millimetres from the page's top-left; font sizes in points.

/** CSS pixels in one millimetre (96 px per inch). */
export const PX_PER_MM = 96 / 25.4;
/** Millimetres in one point (1/72 inch). */
export const MM_PER_PT = 25.4 / 72;

export const NAME_MAX_LENGTH = 50;
export const CUSTOM_PAPER = 'custom';
export const CUSTOM_PAPER_MIN_MM = 50;
export const CUSTOM_PAPER_MAX_MM = 1500;
export const ELEMENTS_MAX = 300;
export const TABLE_ROWS_MAX = 30;
export const TABLE_COLS_MAX = 10;
export const FONT_SIZE_MIN = 6;
export const FONT_SIZE_MAX = 72;
export const STROKE_WIDTH_MAX = 10;
/** Highest job order image number (the backend's MAX_IMAGES_PER_REQUEST). */
export const IMAGE_NUMBER_MAX = 50;
/** Smallest item side in the designer. */
export const MIN_SIZE_MM = 2;

export const LABEL_DEFAULTS = [
  { value: 'masters', label: 'Masters' },
  { value: 'controls', label: 'Controls' },
  { value: 'both', label: 'Both' },
  { value: 'none', label: 'None' },
];

export const FONT_FAMILIES = [
  { value: 'sans', label: 'Sans serif', css: 'Inter, "Segoe UI", Arial, sans-serif' },
  { value: 'serif', label: 'Serif', css: 'Georgia, "Times New Roman", serif' },
  { value: 'mono', label: 'Monospace', css: 'Consolas, "Courier New", monospace' },
];

/** Text as it prints while text formatting is off (or not set). */
export const DEFAULT_STYLE = { fontFamily: 'sans', fontSize: 10, bold: false, italic: false, underline: false, align: 'left', color: '#111827' };
export const DEFAULT_STROKE = { color: '#111827', width: 1, dashed: false };

export const ELEMENT_LABELS = {
  field: 'Field',
  text: 'Text',
  line: 'Line',
  rectangle: 'Rectangle',
  circle: 'Circle',
  table: 'Table',
  logo: 'Company logo',
  image: 'Job order image',
};

export const IMAGE_FITS = [
  { value: 'contain', label: 'Whole image inside the box' },
  { value: 'cover', label: 'Fill the box (edges may be cut)' },
];

/** The type a palette item carries while dragged onto the page. */
export const PALETTE_DRAG_TYPE = 'application/x-layout-item';

/** "Field: Customer address", "Job order image 2", "Rectangle". */
export const elementName = (element, resolve) => {
  if (element.type === 'field') return `Field: ${resolve(element.field).label}`;
  if (element.type === 'image') return `${ELEMENT_LABELS.image} ${element.imageNumber}`;
  return ELEMENT_LABELS[element.type];
};

// Job order / company fields that show their label when dropped.
const LABELLED_SYSTEM_FIELDS = ['jobOrderNumber', 'jobOrderDate', 'subtotal', 'taxSummary', 'total'];

/** The paper as printed: a named size turned for landscape, or the typed size. */
export const paperOf = (paper, paperSizes) => {
  if (paper.size === CUSTOM_PAPER) return { ...paper, orientation: paper.widthMm > paper.heightMm ? 'landscape' : 'portrait' };
  const size = paperSizes.find((p) => p.key === paper.size);
  const isLandscape = paper.orientation === 'landscape';
  return { ...paper, widthMm: isLandscape ? size.heightMm : size.widthMm, heightMm: isLandscape ? size.widthMm : size.heightMm };
};

/** "A4 · Landscape" or "Custom 300 x 100 mm". */
export const describePaper = (paper) =>
  paper.size === CUSTOM_PAPER
    ? `Custom ${paper.widthMm} x ${paper.heightMm} mm`
    : `${paper.size} · ${paper.orientation === 'landscape' ? 'Landscape' : 'Portrait'}`;

/** Whether a dropped field shows its label, from the layout's default. */
export const showsLabelByDefault = (field, labelDefault) => {
  if (field.source === 'system') return LABELLED_SYSTEM_FIELDS.includes(field.key);
  if (labelDefault === 'both') return true;
  return labelDefault === `${field.source}s`;
};

let nextId = 0;
/** A short id, unique on the page. */
export const newElementId = () => `el${Date.now().toString(36)}${(nextId++).toString(36)}`;

/**
 * A new element of a kind, at x / y (mm), at its default size.
 * kind: 'field' (with field), 'text', 'line', 'rectangle', 'circle', 'table', 'logo',
 * 'image' (with imageNumber).
 */
export const createElement = (kind, { x = 10, y = 10, field = null, labelDefault = 'none', imageNumber = 1 } = {}) => {
  const base = { id: newElementId(), type: kind, x, y };
  switch (kind) {
    case 'field':
      return { ...base, width: 60, height: 7, field: { ...field, showLabel: showsLabelByDefault(field, labelDefault), labelText: null } };
    case 'text':
      return { ...base, width: 60, height: 8, text: 'Text' };
    case 'line':
      return { ...base, width: 80, height: 2, direction: 'horizontal', stroke: { ...DEFAULT_STROKE } };
    case 'rectangle':
      return { ...base, width: 60, height: 30, stroke: { ...DEFAULT_STROKE }, fill: null, radius: 0 };
    case 'circle':
      return { ...base, width: 30, height: 30, stroke: { ...DEFAULT_STROKE }, fill: null };
    case 'table':
      return {
        ...base,
        width: 100,
        height: 24,
        stroke: { ...DEFAULT_STROKE, width: 0.5 },
        table: { rows: 3, cols: 2, colWidths: [1, 1], cells: Array.from({ length: 3 }, () => [{ text: '', field: null }, { text: '', field: null }]) },
      };
    case 'logo':
      return { ...base, width: 40, height: 20 };
    case 'image':
      return { ...base, width: 50, height: 40, imageNumber, fit: 'contain' };
    default:
      throw new Error(`Unknown element kind: ${kind}`);
  }
};

/** Keeps an element inside the page: smaller first if needed, then moved in. */
export const fitOnPage = (element, paper) => {
  const width = Math.min(element.width, paper.widthMm);
  const height = Math.min(element.height, paper.heightMm);
  const round = (n) => Math.round(n * 100) / 100;
  return {
    ...element,
    width: round(width),
    height: round(height),
    x: round(Math.min(Math.max(0, element.x), paper.widthMm - width)),
    y: round(Math.min(Math.max(0, element.y), paper.heightMm - height)),
  };
};
