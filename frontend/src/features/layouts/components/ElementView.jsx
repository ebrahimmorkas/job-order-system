import { DEFAULT_STROKE, DEFAULT_STYLE, FONT_FAMILIES } from '../layoutConstants';
import { fieldText } from '../fieldValues';

// One item of a layout, drawn in real units (CSS mm and pt) so the same
// drawing serves the designer, the exports and printing.

const fontCss = Object.fromEntries(FONT_FAMILIES.map((f) => [f.value, f.css]));

/** The CSS of text, from its style (the defaults while formatting is off). */
const textCss = (style, canFormatText) => {
  const s = canFormatText ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE;
  return {
    fontFamily: fontCss[s.fontFamily],
    fontSize: `${s.fontSize}pt`,
    lineHeight: 1.25,
    fontWeight: s.bold ? 700 : 400,
    fontStyle: s.italic ? 'italic' : 'normal',
    textDecoration: s.underline ? 'underline' : 'none',
    textAlign: s.align,
    color: s.color,
  };
};

// Line widths are in points.
const borderOf = (stroke) => {
  const s = { ...DEFAULT_STROKE, ...stroke };
  return `${s.width}pt ${s.dashed ? 'dashed' : 'solid'} ${s.color}`;
};

const TableView = ({ element, resolve, canFormatText }) => {
  const { rows, colWidths, cells } = element.table;
  const shares = colWidths.reduce((sum, w) => sum + w, 0);
  const border = borderOf(element.stroke);
  return (
    <table style={{ width: '100%', height: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', ...textCss(element.style, canFormatText) }}>
      <colgroup>
        {colWidths.map((w, i) => <col key={i} style={{ width: `${(w / shares) * 100}%` }} />)}
      </colgroup>
      <tbody>
        {cells.map((row, r) => (
          <tr key={r} style={{ height: `${100 / rows}%` }}>
            {row.map((cell, c) => (
              <td key={c} style={{ border, padding: '0.5mm 1mm', verticalAlign: 'middle', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', textAlign: 'inherit' }}>
                {cell.field ? fieldText(cell.field, resolve(cell.field)) : cell.text}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/**
 * The inside of an element; the caller places it (left / top / width / height in mm).
 *
 * @param {Object} props
 * @param {Object} props.element
 * @param {(field) => { label, value }} props.resolve - From fieldValues.js
 * @param {boolean} props.canFormatText
 * @param {string|null} props.logoUrl
 * @param {boolean} [props.isDesigner] - Shows a box where nothing would print (no logo)
 */
const ElementView = ({ element, resolve, canFormatText, logoUrl, isDesigner = false }) => {
  switch (element.type) {
    case 'field':
    case 'text': {
      const text = element.type === 'field' ? fieldText(element.field, resolve(element.field)) : element.text;
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word', ...textCss(element.style, canFormatText) }}>
          {text}
        </div>
      );
    }
    case 'line': {
      const isVertical = element.direction === 'vertical';
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={isVertical ? { height: '100%', borderLeft: borderOf(element.stroke) } : { width: '100%', borderTop: borderOf(element.stroke) }} />
        </div>
      );
    }
    case 'rectangle':
    case 'circle':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            border: borderOf(element.stroke),
            background: element.fill || 'transparent',
            borderRadius: element.type === 'circle' ? '50%' : `${element.radius || 0}mm`,
          }}
        />
      );
    case 'table':
      return <TableView element={element} resolve={resolve} canFormatText={canFormatText} />;
    case 'logo':
      if (logoUrl) return <img src={logoUrl} alt="Company logo" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
      return isDesigner ? (
        <div className="flex h-full w-full items-center justify-center border border-dashed border-gray-400 text-[9pt] text-gray-500 text-center">
          Logo (none uploaded)
        </div>
      ) : null;
    default:
      return null;
  }
};

export default ElementView;
