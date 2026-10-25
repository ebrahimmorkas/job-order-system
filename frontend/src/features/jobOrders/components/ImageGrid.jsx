/**
 * A saved job order's images as tiles; each opens full size in a new tab.
 *
 * @param {Object} props
 * @param {Array<{ imageId: string, url: string }>} props.images
 * @param {(index: number) => string} props.altOf - Each image's alt text
 */
const ImageGrid = ({ images, altOf }) => (
  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Job order images">
    {images.map((image, index) => (
      <li key={image.imageId} className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
        <a href={image.url} target="_blank" rel="noopener noreferrer" title="Open full size" className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          <img src={image.url} alt={altOf(index)} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
        </a>
      </li>
    ))}
  </ul>
);

export default ImageGrid;
