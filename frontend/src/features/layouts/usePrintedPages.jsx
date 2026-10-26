import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { TableRows } from './components/ElementView';
import { PX_PER_MM, isRepeatingTable } from './layoutConstants';
import { flowPages, printedTableOf } from './printFlow';

/**
 * The pages a layout prints (printFlow.js). Each table with a repeated row is
 * first drawn out of sight to measure its rows (long text makes a row
 * taller); until then pages is null.
 *
 * @param {Object} params
 * @param {{ elements, headerHeightMm, footerHeightMm }|null} params.layout
 * @param {{ widthMm, heightMm }|null} params.paper - As printed
 * @param {((field, place) => { label, value })|null} params.resolve
 * @param {number} params.itemCount - Items of the job order
 * @param {boolean} params.canFormatText
 * @returns {{ pages: Array<Array<Object>>|null, measurer: React.ReactNode }} - Render measurer anywhere
 */
export const usePrintedPages = ({ layout, paper, resolve, itemCount, canFormatText }) => {
  const tables = useMemo(() => {
    if (!layout || !paper || !resolve) return null;
    return new Map(layout.elements.filter(isRepeatingTable).map((element) => [element.id, { element, ...printedTableOf(element, resolve, itemCount) }]));
  }, [layout, paper, resolve, itemCount]);
  // { tables, heights: id -> each row's height in mm } once drawn.
  const [measured, setMeasured] = useState(null);

  const measure = useCallback((node) => {
    if (!node || !tables) return;
    const heights = new Map();
    for (const box of node.querySelectorAll('[data-measure]')) {
      heights.set(box.dataset.measure, [...box.querySelectorAll('tr')].map((tr) => tr.getBoundingClientRect().height / PX_PER_MM));
    }
    setMeasured({ tables, heights });
  }, [tables]);

  const pages = useMemo(() => {
    if (!tables || measured?.tables !== tables) return null;
    const sized = new Map([...tables].map(([id, table]) => [id, {
      colWidths: table.colWidths,
      rows: table.rows.map((row, i) => ({ ...row, heightMm: Math.max(table.designedRowMm, measured.heights.get(id)?.[i] ?? 0) })),
    }]));
    return flowPages({ paper, elements: layout.elements, headerHeightMm: layout.headerHeightMm || 0, footerHeightMm: layout.footerHeightMm || 0 }, sized);
  }, [tables, measured, paper, layout]);

  const measurer = tables && createPortal(
    <div ref={measure} aria-hidden="true" style={{ position: 'fixed', left: -100000, top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      {[...tables].map(([id, table]) => (
        <div key={id} data-measure={id} style={{ width: `${table.element.width}mm` }}>
          <TableRows
            element={table.element}
            colWidths={table.colWidths}
            rows={table.rows.map((row) => ({ ...row, height: `${table.designedRowMm}mm` }))}
            canFormatText={canFormatText}
          />
        </div>
      ))}
    </div>,
    document.body,
  );

  return { pages, measurer };
};
