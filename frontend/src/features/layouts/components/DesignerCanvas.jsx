import { useRef } from 'react';
import ElementView from './ElementView';
import { MIN_SIZE_MM, PALETTE_DRAG_TYPE, PX_PER_MM, elementName } from '../layoutConstants';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const HANDLE_CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
// Where each handle sits on the box, as fractions of its width / height.
const HANDLE_SPOTS = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };

const round2 = (n) => Math.round(n * 100) / 100;
// Snaps to whole millimetres unless Alt is held.
const snap = (n, isFree) => (isFree ? round2(n) : Math.round(n));
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

// Stretching the page by its edges zooms the view (the paper stays the same).
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
const EDGES = ['n', 'e', 's', 'w'];
const EDGE_SPOTS = {
  n: { top: -12, left: 0, right: 0, height: 12, cursor: 'ns-resize' },
  s: { bottom: -12, left: 0, right: 0, height: 12, cursor: 'ns-resize' },
  e: { right: -12, top: 0, bottom: 0, width: 12, cursor: 'ew-resize' },
  w: { left: -12, top: 0, bottom: 0, width: 12, cursor: 'ew-resize' },
};
const EDGE_NAMES = { n: 'top', e: 'right', s: 'bottom', w: 'left' };
// Inside a table: tells it apart from the page.
const GUIDE_COLORS = { page: '#4f46e5', table: '#059669' };
const TOLERANCE_MM = 0.01;

const formatMm = (n) => `${Math.round(n * 10) / 10} mm`;

// The table the item sits in (the smallest, if tables overlap), else the page.
const boxAround = (element, elements, paper) => {
  const tables = elements.filter((e) => e.type === 'table' && e.id !== element.id
    && element.x >= e.x - TOLERANCE_MM && element.y >= e.y - TOLERANCE_MM
    && element.x + element.width <= e.x + e.width + TOLERANCE_MM && element.y + element.height <= e.y + e.height + TOLERANCE_MM);
  if (tables.length === 0) return { x: 0, y: 0, width: paper.widthMm, height: paper.heightMm, isTable: false };
  const table = tables.reduce((a, b) => (a.width * a.height <= b.width * b.height ? a : b));
  return { x: table.x, y: table.y, width: table.width, height: table.height, isTable: true };
};

/**
 * How far the selected item is from the left, right, top and bottom of the
 * page - or of the table it sits in: a dashed line and the millimetres.
 */
const DistanceGuides = ({ element, elements, paper, zoom }) => {
  const box = boxAround(element, elements, paper);
  const color = box.isTable ? GUIDE_COLORS.table : GUIDE_COLORS.page;
  const midX = element.x + element.width / 2;
  const midY = element.y + element.height / 2;
  const line = `${1 / zoom}px dashed ${color}`;
  const sides = [
    { key: 'left', size: element.x - box.x, line: { left: `${box.x}mm`, top: `${midY}mm`, width: `${element.x - box.x}mm`, borderTop: line } },
    { key: 'right', size: box.x + box.width - element.x - element.width, line: { left: `${element.x + element.width}mm`, top: `${midY}mm`, width: `${box.x + box.width - element.x - element.width}mm`, borderTop: line } },
    { key: 'top', size: element.y - box.y, line: { left: `${midX}mm`, top: `${box.y}mm`, height: `${element.y - box.y}mm`, borderLeft: line } },
    { key: 'bottom', size: box.y + box.height - element.y - element.height, line: { left: `${midX}mm`, top: `${element.y + element.height}mm`, height: `${box.y + box.height - element.y - element.height}mm`, borderLeft: line } },
  ];
  return (
    <div aria-hidden="true" data-guides={box.isTable ? 'table' : 'page'} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {box.isTable && (
        <div style={{ position: 'absolute', left: `${box.x}mm`, top: `${box.y}mm`, width: `${box.width}mm`, height: `${box.height}mm`, outline: `${1.5 / zoom}px solid ${color}` }} />
      )}
      {sides.filter((side) => side.size > TOLERANCE_MM).map((side) => (
        <div key={side.key} style={{ position: 'absolute', ...side.line }}>
          <span
            data-distance={side.key}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap',
              background: color,
              color: '#ffffff',
              fontFamily: 'Inter, "Segoe UI", Arial, sans-serif',
              fontSize: 10 / zoom,
              lineHeight: 1.2,
              fontWeight: 600,
              padding: `${1 / zoom}px ${4 / zoom}px`,
              borderRadius: 4 / zoom,
            }}
          >
            {formatMm(side.size)}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * The page being designed: click to select, drag to move, drag a handle to
 * resize (1 mm steps; hold Alt for finer), drop palette items on it. The
 * selected item shows its distance from each side of the page (or of the
 * table it sits in). Dragging an edge of the page zooms the view.
 *
 * @param {Object} props
 * @param {{ widthMm, heightMm }} props.paper - As printed
 * @param {Array} props.elements
 * @param {string|null} props.selectedId
 * @param {(id: string|null) => void} props.onSelect
 * @param {() => void} props.onBeginChange - Before the first move of a drag (for undo)
 * @param {(id: string, patch: Object) => void} props.onMove - While dragging
 * @param {(item: Object, xMm: number, yMm: number) => void} props.onDropItem
 * @param {number} props.zoom - 1 = real size
 * @param {(zoom: number) => void} props.onZoomChange - While an edge of the page is dragged
 * @param {(field) => { label, value }} props.resolve
 * @param {boolean} props.canFormatText
 * @param {string|null} props.logoUrl
 */
const DesignerCanvas = ({ paper, elements, selectedId, onSelect, onBeginChange, onMove, onDropItem, zoom, onZoomChange, resolve, canFormatText, logoUrl }) => {
  const pageRef = useRef(null);
  const outerRef = useRef(null);
  const pxPerMm = PX_PER_MM * zoom;
  const selected = elements.find((e) => e.id === selectedId) || null;

  // Zooms with the pointer: an edge follows it. While the page is narrower
  // than the design area it stays centred, so a side edge moves half as far.
  const startStretch = (e, edge) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const isSide = edge === 'e' || edge === 'w';
    const realPx = (isSide ? paper.widthMm : paper.heightMm) * PX_PER_MM;
    const sign = edge === 'e' || edge === 's' ? 1 : -1;
    let last = isSide ? e.clientX : e.clientY;
    let current = zoom;

    const handleMove = (moveEvent) => {
      const at = isSide ? moveEvent.clientX : moveEvent.clientY;
      const area = outerRef.current?.parentElement?.parentElement;
      const isCentred = isSide && area && current * realPx < area.clientWidth - 48;
      current = clamp(current + ((at - last) * sign * (isCentred ? 2 : 1)) / realPx, ZOOM_MIN, ZOOM_MAX);
      last = at;
      onZoomChange(Math.round(current * 100) / 100);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const startDrag = (e, element, handle = null) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(element.id);
    const start = { x: e.clientX, y: e.clientY };
    let hasMoved = false;

    const handleMove = (moveEvent) => {
      const dx = (moveEvent.clientX - start.x) / pxPerMm;
      const dy = (moveEvent.clientY - start.y) / pxPerMm;
      if (!hasMoved) {
        if (Math.abs(dx) * pxPerMm < 2 && Math.abs(dy) * pxPerMm < 2) return;
        hasMoved = true;
        onBeginChange();
      }
      const isFree = moveEvent.altKey;
      if (!handle) {
        onMove(element.id, {
          x: clamp(snap(element.x + dx, isFree), 0, round2(paper.widthMm - element.width)),
          y: clamp(snap(element.y + dy, isFree), 0, round2(paper.heightMm - element.height)),
        });
        return;
      }
      let left = element.x;
      let top = element.y;
      let right = element.x + element.width;
      let bottom = element.y + element.height;
      if (handle.includes('w')) left = clamp(snap(left + dx, isFree), 0, right - MIN_SIZE_MM);
      if (handle.includes('e')) right = clamp(snap(right + dx, isFree), left + MIN_SIZE_MM, paper.widthMm);
      if (handle.includes('n')) top = clamp(snap(top + dy, isFree), 0, bottom - MIN_SIZE_MM);
      if (handle.includes('s')) bottom = clamp(snap(bottom + dy, isFree), top + MIN_SIZE_MM, paper.heightMm);
      onMove(element.id, { x: round2(left), y: round2(top), width: round2(right - left), height: round2(bottom - top) });
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const handleDragOver = (e) => {
    if (!e.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    const data = e.dataTransfer.getData(PALETTE_DRAG_TYPE);
    if (!data) return;
    e.preventDefault();
    const rect = pageRef.current.getBoundingClientRect();
    onDropItem(JSON.parse(data), Math.round((e.clientX - rect.left) / pxPerMm), Math.round((e.clientY - rect.top) / pxPerMm));
  };

  const handleSize = 9 / zoom;

  return (
    <div ref={outerRef} style={{ position: 'relative', width: paper.widthMm * pxPerMm, height: paper.heightMm * pxPerMm }} className="shadow-lg ring-1 ring-gray-300 bg-white">
      {EDGES.map((edge) => {
        const { cursor, ...spot } = EDGE_SPOTS[edge];
        const isSide = edge === 'e' || edge === 'w';
        return (
          <div
            key={edge}
            role="separator"
            aria-label={`Stretch the page from the ${EDGE_NAMES[edge]}`}
            title="Drag to make the page bigger or smaller on screen"
            onPointerDown={(e) => startStretch(e, edge)}
            className="group absolute z-10 flex items-center justify-center"
            style={{ ...spot, cursor, touchAction: 'none' }}
          >
            <span className={`rounded-full bg-gray-300 transition-colors group-hover:bg-indigo-500 ${isSide ? 'h-12 w-1.5' : 'h-1.5 w-12'}`} />
          </div>
        );
      })}
      <div
        ref={pageRef}
        role="application"
        aria-label="Page"
        onPointerDown={() => onSelect(null)}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{
          position: 'relative',
          width: `${paper.widthMm}mm`,
          height: `${paper.heightMm}mm`,
          transform: `scale(${zoom})`,
          transformOrigin: '0 0',
          background: '#ffffff',
          backgroundImage: 'radial-gradient(circle, #e5e7eb 0.6px, transparent 0.6px)',
          backgroundSize: '5mm 5mm',
          color: '#111827',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {elements.map((element) => {
          const isSelected = element.id === selectedId;
          return (
            <div
              key={element.id}
              data-element-id={element.id}
              role="button"
              tabIndex={-1}
              aria-label={elementName(element, resolve)}
              aria-pressed={isSelected}
              onPointerDown={(e) => startDrag(e, element)}
              style={{
                position: 'absolute',
                left: `${element.x}mm`,
                top: `${element.y}mm`,
                width: `${element.width}mm`,
                height: `${element.height}mm`,
                cursor: 'move',
                outline: isSelected ? `${1.5 / zoom}px solid #4f46e5` : `${1 / zoom}px dashed rgba(99, 102, 241, 0.35)`,
                outlineOffset: 0,
              }}
            >
              <ElementView element={element} resolve={resolve} canFormatText={canFormatText} logoUrl={logoUrl} isDesigner />
              {isSelected && HANDLES.map((handle) => (
                <span
                  key={handle}
                  aria-hidden="true"
                  onPointerDown={(e) => startDrag(e, element, handle)}
                  style={{
                    position: 'absolute',
                    left: `calc(${HANDLE_SPOTS[handle][0] * 100}% - ${handleSize / 2}px)`,
                    top: `calc(${HANDLE_SPOTS[handle][1] * 100}% - ${handleSize / 2}px)`,
                    width: handleSize,
                    height: handleSize,
                    background: '#ffffff',
                    border: `${1.5 / zoom}px solid #4f46e5`,
                    borderRadius: 2 / zoom,
                    cursor: HANDLE_CURSORS[handle],
                  }}
                />
              ))}
            </div>
          );
        })}
        {selected && <DistanceGuides element={selected} elements={elements} paper={paper} zoom={zoom} />}
      </div>
    </div>
  );
};

export default DesignerCanvas;
