import { useState } from 'react';
import Button from '../../../components/common/Buttons';
import Checkbox from '../../../components/common/Checkbox';
import Dropdown from '../../../components/common/DropDown';
import InputField from '../../../components/common/InputField';
import TextArea from '../../../components/common/TextArea';
import NumberField from '../../../components/common/NumberField';
import ColorField from '../../../components/common/ColorField';
import { CopyIcon, TrashIcon } from '../../../components/common/ActionIcons';
import {
  CUSTOM_PAPER_MAX_MM, DEFAULT_STROKE, DEFAULT_STYLE, ELEMENT_LABELS, FONT_FAMILIES, FONT_SIZE_MAX, FONT_SIZE_MIN,
  IMAGE_FITS, IMAGE_NUMBER_MAX, ITEM_FIELD_KEYS, MIN_SIZE_MM, bandOf, elementName, isRepeatingTable, printsOnEveryPage, STROKE_WIDTH_MAX, TABLE_COLS_MAX,
  TABLE_LINES, TABLE_ROWS_MAX,
} from '../layoutConstants';

const LABEL_MAX_LENGTH = 60;

// What "Print on every page" means where the item is.
const EVERY_PAGE_HINTS = {
  header: 'In the header. Unticked: the first page only.',
  footer: 'In the footer. Unticked: the last page only.',
  body: 'Ticked: at this spot on every page, never moved down.',
};
const TEXT_MAX_LENGTH = 1000;

const FONT_OPTIONS = FONT_FAMILIES.map(({ value, label }) => ({ value, label }));
const DIRECTION_OPTIONS = [
  { value: 'horizontal', label: 'Across' },
  { value: 'vertical', label: 'Down' },
];
const ALIGNS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Centre' },
  { value: 'right', label: 'Right' },
];

// A field as one dropdown value: "system:total", "master:<id>".
const fieldKeyOf = (field) => (field ? `${field.source}:${field.key || field.refId}` : '');
const fieldFromKey = (key) => {
  const [source, ref] = key.split(':');
  return source === 'system' ? { source, key: ref } : { source, refId: ref };
};

const Section = ({ title, children }) => (
  <section className="space-y-3 border-t border-gray-100 pt-3">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
    {children}
  </section>
);

const ToggleButton = ({ isOn, onClick, label, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isOn}
    aria-label={label}
    title={label}
    className={`h-8 min-w-8 rounded-md border px-2 text-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isOn ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
  >
    {children}
  </button>
);

const StyleFields = ({ style, onChange }) => {
  const s = { ...DEFAULT_STYLE, ...style };
  const set = (patch, key) => onChange({ style: { ...s, ...patch } }, key);
  return (
    <Section title="Text">
      <div className="grid grid-cols-2 gap-2">
        <Dropdown label="Font" aria-label="Font" size="sm" options={FONT_OPTIONS} value={s.fontFamily} onChange={(value) => set({ fontFamily: value })} />
        <NumberField label="Size" unit="pt" min={FONT_SIZE_MIN} max={FONT_SIZE_MAX} step={0.5} value={s.fontSize} onChange={(value) => set({ fontSize: value }, 'fontSize')} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <ToggleButton isOn={s.bold} onClick={() => set({ bold: !s.bold })} label="Bold"><b>B</b></ToggleButton>
        <ToggleButton isOn={s.italic} onClick={() => set({ italic: !s.italic })} label="Italic"><i>I</i></ToggleButton>
        <ToggleButton isOn={s.underline} onClick={() => set({ underline: !s.underline })} label="Underline"><u>U</u></ToggleButton>
        <span className="mx-1 w-px bg-gray-200" aria-hidden="true" />
        {ALIGNS.map((a) => (
          <ToggleButton key={a.value} isOn={s.align === a.value} onClick={() => set({ align: a.value })} label={`Align ${a.label.toLowerCase()}`}>{a.label}</ToggleButton>
        ))}
      </div>
      <ColorField label="Colour" value={s.color} onChange={(value) => set({ color: value }, 'color')} />
    </Section>
  );
};

const StrokeFields = ({ stroke, onChange, title = 'Line' }) => {
  const s = { ...DEFAULT_STROKE, ...stroke };
  const set = (patch, key) => onChange({ stroke: { ...s, ...patch } }, key);
  return (
    <Section title={title}>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Colour" value={s.color} onChange={(value) => set({ color: value }, 'strokeColor')} />
        <NumberField label="Thickness" unit="pt" min={0} max={STROKE_WIDTH_MAX} step={0.25} value={s.width} onChange={(value) => set({ width: value }, 'strokeWidth')} />
      </div>
      <Checkbox size="sm" name="strokeDashed" label="Dashed" checked={s.dashed} onChange={(e) => set({ dashed: e.target.checked })} />
    </Section>
  );
};

const FillFields = ({ fill, onChange }) => (
  <div className="space-y-2">
    <Checkbox size="sm" name="fill" label="Fill" checked={!!fill} onChange={(e) => onChange({ fill: e.target.checked ? '#eef2ff' : null })} />
    {fill && <ColorField label="Fill colour" value={fill} onChange={(value) => onChange({ fill: value }, 'fill')} />}
  </div>
);

// isPrice: a price control - it can show its price for one (÷ the item's quantity).
const LabelFields = ({ field, defaultLabel, isPrice = false, onChange }) => (
  <div className="space-y-2">
    {isPrice && (
      <Checkbox
        size="sm"
        name="perOne"
        label="Price for one"
        description="The amount divided by the item's quantity."
        checked={field.perOne === true}
        onChange={(e) => onChange({ field: { ...field, perOne: e.target.checked } })}
      />
    )}
    <Checkbox
      size="sm"
      name="showLabel"
      label="Show label"
      description={`"${defaultLabel}: value" instead of "value"`}
      checked={field.showLabel}
      onChange={(e) => onChange({ field: { ...field, showLabel: e.target.checked } })}
    />
    {field.showLabel && (
      <InputField
        label="Label text"
        placeholder={defaultLabel}
        maxLength={LABEL_MAX_LENGTH}
        value={field.labelText || ''}
        onChange={(e) => onChange({ field: { ...field, labelText: e.target.value || null } }, 'labelText')}
      />
    )}
  </div>
);

const NO_ROW_STYLE = { bold: false, fill: null };

// Rows / columns, column widths, lines, what each cell shows, and the row
// printed once for each item of the job order (with its row styles and
// columns hidden when no item has a value).
const TableFields = ({ element, fieldOptions, resolve, isPriceField, onChange }) => {
  const { table } = element;
  const [cellAt, setCellAt] = useState({ row: 0, col: 0 });
  const row = Math.min(cellAt.row, table.rows - 1);
  const col = Math.min(cellAt.col, table.cols - 1);
  const cell = table.cells[row][col];
  const setTable = (patch, key) => onChange({ table: { ...table, ...patch } }, key);
  const repeatRow = Number.isInteger(table.repeatRow) ? table.repeatRow : null;
  const rowStyleOf = (r) => table.rowStyles?.[r] || NO_ROW_STYLE;
  const rowStyle = rowStyleOf(row);
  const setRowStyle = (patch, key) => setTable({ rowStyles: Array.from({ length: table.rows }, (_, r) => (r === row ? { ...rowStyle, ...patch } : rowStyleOf(r))) }, key);
  // The column of the picked cell can hide when its repeated cell is a field.
  const canHideCol = repeatRow !== null && !!table.cells[repeatRow][col].field;
  const setHideCol = (isHidden) => setTable({ hideEmptyCols: Array.from({ length: table.cols }, (_, c) => (c === col ? isHidden : !!table.hideEmptyCols?.[c])) });

  const resize = (rows, cols) => {
    const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (__, c) => table.cells[r]?.[c] || { text: '', field: null }));
    const colWidths = Array.from({ length: cols }, (_, c) => table.colWidths[c] || 1);
    const patch = { rows, cols, cells, colWidths, repeatRow: repeatRow !== null && repeatRow < rows ? repeatRow : null };
    if (table.rowStyles) patch.rowStyles = Array.from({ length: rows }, (_, r) => rowStyleOf(r));
    if (table.hideEmptyCols) patch.hideEmptyCols = Array.from({ length: cols }, (_, c) => !!table.hideEmptyCols[c]);
    setTable(patch);
  };
  const setCell = (patch, key) => {
    const cells = table.cells.map((cells, r) => (r === row ? cells.map((c, i) => (i === col ? { ...c, ...patch } : c)) : cells));
    setTable({ cells }, key && `${key}-${row}-${col}`);
  };

  return (
    <Section title="Table">
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Rows" min={1} max={TABLE_ROWS_MAX} value={table.rows} onChange={(value) => Number.isInteger(value) && resize(value, table.cols)} />
        <NumberField label="Columns" min={1} max={TABLE_COLS_MAX} value={table.cols} onChange={(value) => Number.isInteger(value) && resize(table.rows, value)} />
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Column widths (shares)</p>
        <div className="grid grid-cols-5 gap-1.5">
          {table.colWidths.map((width, i) => (
            <NumberField
              key={i}
              label={`Col ${i + 1}`}
              min={1}
              max={100}
              value={width}
              onChange={(value) => setTable({ colWidths: table.colWidths.map((w, j) => (j === i ? value : w)) }, `colWidth-${i}`)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-gray-600">Pick a cell</p>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${table.cols}, minmax(0, 1fr))` }}>
          {table.cells.flatMap((cells, r) => cells.map((c, i) => {
            const isPicked = r === row && i === col;
            const isRepeat = r === repeatRow;
            const shown = c.field ? resolve(c.field).label : c.text;
            let look = 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50';
            if (isPicked) look = 'border-indigo-500 bg-indigo-50 text-indigo-700';
            else if (isRepeat) look = 'border-dashed border-indigo-400 bg-indigo-50/60 text-indigo-700 hover:bg-indigo-50';
            return (
              <button
                key={`${r}-${i}`}
                type="button"
                onClick={() => setCellAt({ row: r, col: i })}
                aria-label={`Cell row ${r + 1} column ${i + 1}${isRepeat ? ' (repeats for each item)' : ''}`}
                aria-pressed={isPicked}
                title={`${shown || 'Empty'}${isRepeat ? ' - repeats for each item' : ''}`}
                className={`h-7 truncate rounded border px-1 text-[11px] cursor-pointer ${look} ${c.field ? 'italic' : ''}`}
              >
                {shown || '·'}
              </button>
            );
          }))}
        </div>
        {repeatRow !== null && (
          <p className="mt-1 text-xs text-indigo-700">
            Row {repeatRow + 1} prints once for each item. The table grows and what is below it moves down; rows above it repeat on a new page.
          </p>
        )}
      </div>
      <Dropdown label="Lines" aria-label="Table lines" size="sm" options={TABLE_LINES} value={table.lines || 'all'} onChange={(value) => setTable({ lines: value || 'all' })} />
      <div className="space-y-2 rounded-md bg-gray-50 p-2">
        <p className="text-xs font-medium text-gray-700">Row {row + 1}</p>
        <Checkbox
          size="sm"
          name="repeatRow"
          label="Repeat this row for each item"
          description="One row per item of the job order, e.g. Job order name and Cutting."
          checked={repeatRow === row}
          onChange={(e) => setTable({ repeatRow: e.target.checked ? row : null })}
        />
        <Checkbox size="sm" name="rowBold" label="Bold" checked={rowStyle.bold} onChange={(e) => setRowStyle({ bold: e.target.checked })} />
        <Checkbox size="sm" name="rowFill" label="Background colour" checked={!!rowStyle.fill} onChange={(e) => setRowStyle({ fill: e.target.checked ? '#eef2ff' : null })} />
        {rowStyle.fill && <ColorField label="Row colour" value={rowStyle.fill} onChange={(value) => setRowStyle({ fill: value }, `rowFill-${row}`)} />}
      </div>
      {canHideCol && (
        <div className="space-y-2 rounded-md bg-gray-50 p-2">
          <p className="text-xs font-medium text-gray-700">Column {col + 1}</p>
          <Checkbox
            size="sm"
            name="hideEmptyCol"
            label="Hide when no item has a value"
            description={'Otherwise an empty value prints "-".'}
            checked={!!table.hideEmptyCols?.[col]}
            onChange={(e) => setHideCol(e.target.checked)}
          />
        </div>
      )}
      <div className="space-y-2 rounded-md bg-gray-50 p-2">
        <p className="text-xs font-medium text-gray-700">Row {row + 1}, column {col + 1}</p>
        <Dropdown
          label="Shows"
          aria-label="Cell shows"
          size="sm"
          searchable
          options={[{ value: '', label: 'Typed text' }, ...fieldOptions]}
          value={fieldKeyOf(cell.field)}
          onChange={(value) => setCell(value ? { text: '', field: { ...fieldFromKey(value), showLabel: false, labelText: null } } : { field: null })}
        />
        {cell.field ? (
          <LabelFields field={cell.field} defaultLabel={resolve(cell.field).label} isPrice={isPriceField(cell.field)} onChange={(patch, key) => setCell(patch, key)} />
        ) : (
          <TextArea label="Text" rows={2} maxLength={TEXT_MAX_LENGTH} value={cell.text} onChange={(e) => setCell({ text: e.target.value }, 'cellText')} />
        )}
      </div>
    </Section>
  );
};

/**
 * Settings of the selected item: place and size, then what its kind has.
 *
 * @param {Object} props
 * @param {Object} props.element
 * @param {{ widthMm, heightMm }} props.paper
 * @param {{ headerHeightMm: number, footerHeightMm: number }} props.bands
 * @param {boolean} [props.isExtraPage] - On a page printed once (no "Print on every page")
 * @param {{ masters, controls, systemFields }} props.sources
 * @param {(field) => { label, value }} props.resolve
 * @param {boolean} props.canFormatText
 * @param {(patch: Object, mergeKey?: string) => void} props.onChange - mergeKey: one undo step while typing
 * @param {() => void} props.onDuplicate
 * @param {() => void} props.onDelete
 * @param {(where: 'front'|'back') => void} props.onArrange
 */
const PropertiesPanel = ({ element, paper, bands, isExtraPage = false, sources, resolve, canFormatText, onChange, onDuplicate, onDelete, onArrange }) => {
  // Active masters / controls, plus an inactive one this item already shows.
  const usedIds = new Set([element.field, ...(element.table?.cells.flat().map((cell) => cell.field) || [])].filter(Boolean).map((field) => field.refId));
  const isOffered = (doc) => doc.status === 'A' || usedIds.has(doc._id);
  const fieldOptions = [
    ...sources.systemFields.map((f) => ({ value: `system:${f.key}`, label: ITEM_FIELD_KEYS.includes(f.key) ? `Item: ${f.label}` : f.label })),
    ...sources.masters.filter(isOffered).map((m) => ({ value: `master:${m._id}`, label: `Master: ${m.name}${m.status === 'A' ? '' : ' (inactive)'}` })),
    ...sources.controls.filter(isOffered).map((c) => ({ value: `control:${c._id}`, label: `Control: ${c.label}${c.status === 'A' ? '' : ' (inactive)'}` })),
  ];
  const band = bandOf(element, bands, paper);
  const isPriceField = (field) => field?.source === 'control' && sources.controls.some((control) => control._id === field.refId && control.isPrice);
  // A growing table in between always flows with the page.
  const canRepeat = !isExtraPage && !(band === 'body' && isRepeatingTable(element));
  const hasText = ['field', 'text', 'table'].includes(element.type);
  const title = element.type === 'field' ? resolve(element.field).label : elementName(element, resolve);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">{ELEMENT_LABELS[element.type]}</p>
        <h2 className="text-base font-semibold text-gray-900 break-words">{title}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField label="X (from left)" unit="mm" min={0} max={paper.widthMm - element.width} step={0.5} value={element.x} onChange={(value) => onChange({ x: value }, 'x')} />
        <NumberField label="Y (from top)" unit="mm" min={0} max={paper.heightMm - element.height} step={0.5} value={element.y} onChange={(value) => onChange({ y: value }, 'y')} />
        <NumberField label="Width" unit="mm" min={MIN_SIZE_MM} max={Math.min(CUSTOM_PAPER_MAX_MM, paper.widthMm - element.x)} step={0.5} value={element.width} onChange={(value) => onChange({ width: value }, 'width')} />
        <NumberField label="Height" unit="mm" min={MIN_SIZE_MM} max={Math.min(CUSTOM_PAPER_MAX_MM, paper.heightMm - element.y)} step={0.5} value={element.height} onChange={(value) => onChange({ height: value }, 'height')} />
      </div>

      {canRepeat && (
        <Checkbox
          size="sm"
          name="everyPage"
          label="Print on every page"
          description={EVERY_PAGE_HINTS[band]}
          checked={printsOnEveryPage(element, band)}
          onChange={(e) => onChange({ everyPage: e.target.checked })}
        />
      )}

      {element.type === 'field' && (
        <Section title="Label">
          <LabelFields field={element.field} defaultLabel={resolve(element.field).label} isPrice={isPriceField(element.field)} onChange={onChange} />
        </Section>
      )}

      {element.type === 'text' && (
        <TextArea label="Text" rows={3} maxLength={TEXT_MAX_LENGTH} value={element.text} onChange={(e) => onChange({ text: e.target.value }, 'text')} />
      )}

      {element.type === 'line' && (
        <Dropdown label="Direction" aria-label="Direction" size="sm" options={DIRECTION_OPTIONS} value={element.direction || 'horizontal'} onChange={(value) => onChange({ direction: value })} />
      )}

      {element.type === 'table' && <TableFields key={element.id} element={element} fieldOptions={fieldOptions} resolve={resolve} isPriceField={isPriceField} onChange={onChange} />}

      {['line', 'rectangle', 'circle', 'table'].includes(element.type) && (
        <StrokeFields stroke={element.stroke} onChange={onChange} title={element.type === 'table' ? 'Borders' : 'Line'} />
      )}

      {['rectangle', 'circle'].includes(element.type) && <FillFields fill={element.fill} onChange={onChange} />}

      {element.type === 'rectangle' && (
        <NumberField label="Corner radius" unit="mm" min={0} max={100} step={0.5} value={element.radius || 0} onChange={(value) => onChange({ radius: value }, 'radius')} />
      )}

      {element.type === 'logo' && <p className="text-xs text-gray-500">Shows the logo from Company Settings, fitted inside the box.</p>}

      {element.type === 'image' && (
        <Section title="Image">
          <NumberField
            label="Image number"
            min={1}
            max={IMAGE_NUMBER_MAX}
            value={element.imageNumber}
            onChange={(value) => Number.isInteger(value) && onChange({ imageNumber: value }, 'imageNumber')}
          />
          <Dropdown label="Fit" aria-label="Image fit" size="sm" options={IMAGE_FITS} value={element.fit || 'contain'} onChange={(value) => onChange({ fit: value })} />
          <p className="text-xs text-gray-500">Prints the job order's image of this number (1 = the first one added). Left empty when the job order has fewer images.</p>
        </Section>
      )}

      {hasText && canFormatText && <StyleFields style={element.style} onChange={onChange} />}

      <Section title="Arrange">
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => onArrange('front')}>Bring to front</Button>
          <Button size="xs" variant="outline" onClick={() => onArrange('back')}>Send to back</Button>
          <Button size="xs" variant="outline" leftIcon={<CopyIcon className="w-4 h-4" />} onClick={onDuplicate}>Duplicate</Button>
          <Button size="xs" variant="danger" leftIcon={<TrashIcon className="w-4 h-4" />} onClick={onDelete}>Delete</Button>
        </div>
      </Section>
    </div>
  );
};

export default PropertiesPanel;
