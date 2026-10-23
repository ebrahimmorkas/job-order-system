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

/**
 * The page being designed: click to select, drag to move, drag a handle to
 * resize (1 mm steps; hold Alt for finer), drop palette items on it.
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
 * @param {(field) => { label, value }} props.resolve
 * @param {boolean} props.canFormatText
 * @param {string|null} props.logoUrl
 */
const DesignerCanvas = ({ paper, elements, selectedId, onSelect, onBeginChange, onMove, onDropItem, zoom, resolve, canFormatText, logoUrl }) => {
  const pageRef = useRef(null);
  const pxPerMm = PX_PER_MM * zoom;

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
    <div style={{ width: paper.widthMm * pxPerMm, height: paper.heightMm * pxPerMm }} className="shadow-lg ring-1 ring-gray-300 bg-white">
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
      </div>
    </div>
  );
};

export default DesignerCanvas;
