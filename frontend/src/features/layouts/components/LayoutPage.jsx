import { forwardRef } from 'react';
import ElementView from './ElementView';

/**
 * A whole page, at real size: white paper with every element in place. Used
 * for exports, printing and the print preview (scale it with a wrapper).
 *
 * @param {Object} props
 * @param {{ widthMm, heightMm }} props.paper - As printed (see paperOf)
 * @param {Array} props.elements
 * @param {(field) => { label, value }} props.resolve
 * @param {boolean} props.canFormatText
 * @param {string|null} props.logoUrl
 * @param {string[]|null} [props.images] - The job order's image URLs
 */
const LayoutPage = forwardRef(({ paper, elements, resolve, canFormatText, logoUrl, images = null }, ref) => (
  <div
    ref={ref}
    style={{ position: 'relative', width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm`, background: '#ffffff', overflow: 'hidden', color: '#111827' }}
  >
    {elements.map((element) => (
      <div
        key={element.id}
        style={{ position: 'absolute', left: `${element.x}mm`, top: `${element.y}mm`, width: `${element.width}mm`, height: `${element.height}mm` }}
      >
        <ElementView element={element} resolve={resolve} canFormatText={canFormatText} logoUrl={logoUrl} images={images} />
      </div>
    ))}
  </div>
));

LayoutPage.displayName = 'LayoutPage';

export default LayoutPage;
