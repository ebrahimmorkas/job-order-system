import { forwardRef, useCallback } from 'react';
import ElementView from './ElementView';

/**
 * A whole page, at real size: white paper with every element in place. Used
 * for exports, printing and the print preview (scale it with a wrapper).
 *
 * @param {Object} props
 * @param {{ widthMm, heightMm }} props.paper - As printed
 * @param {Array} props.elements - Placed (a printed page's come from usePrintedPages)
 * @param {(field, place) => { label, value }} props.resolve
 * @param {boolean} props.canFormatText
 * @param {string|null} props.logoUrl
 * @param {string[]|null} [props.images] - The job order's image URLs
 * @param {{ number, count }} [props.page] - For "Page 1 of 2"
 * @param {Object} [props.style] - Added to the page's own (e.g. a page break)
 */
const LayoutPage = forwardRef(({ paper, elements, resolve, canFormatText, logoUrl, images = null, page = { number: 1, count: 1 }, style }, ref) => {
  const resolveHere = useCallback((field, place) => resolve(field, { ...place, page }), [resolve, page]);
  return (
    <div
      ref={ref}
      style={{ position: 'relative', width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm`, background: '#ffffff', overflow: 'hidden', color: '#111827', ...style }}
    >
      {elements.map((element) => (
        <div
          key={element.id}
          style={{ position: 'absolute', left: `${element.x}mm`, top: `${element.y}mm`, width: `${element.width}mm`, height: `${element.height}mm`, overflow: 'hidden' }}
        >
          <ElementView element={element} resolve={resolveHere} canFormatText={canFormatText} logoUrl={logoUrl} images={images} />
        </div>
      ))}
    </div>
  );
});

LayoutPage.displayName = 'LayoutPage';

export default LayoutPage;
