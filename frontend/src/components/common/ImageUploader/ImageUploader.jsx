import { useRef, useState } from 'react';
import UsagePill from '../UsagePill';

const IMAGE_LABELS = { 'image/jpeg': 'JPG', 'image/png': 'PNG', 'image/webp': 'WebP', 'image/gif': 'GIF' };

const RemoveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const AddIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.16-5.16a2.25 2.25 0 013.18 0l5.16 5.16m-1.5-1.5l1.41-1.41a2.25 2.25 0 013.18 0l2.91 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V4.5a1.5 1.5 0 00-1.5-1.5H3.75a1.5 1.5 0 00-1.5 1.5v15a1.5 1.5 0 001.5 1.5zM13.5 8.25h.008v.008H13.5V8.25z" />
  </svg>
);

// "JPG, PNG or WebP"
const listNames = (mimeTypes) => {
  const names = mimeTypes.map((type) => IMAGE_LABELS[type] || type);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names.join('');
};

/**
 * A grid of images with "Add images" (click or drag and drop) and a remove
 * button on each. Holds no list of its own: the parent keeps the images (saved
 * ones and newly picked ones) and gets only the files that pass the checks.
 *
 * @param {Object} props
 * @param {Array<{ key: string, src: string, name?: string }>} props.images - What is shown; src may be an object URL
 * @param {(files: File[]) => void} props.onAdd - Picked files that are the right type and size and fit the count
 * @param {(key: string) => void} props.onRemove
 * @param {string[]} [props.accept] - Allowed MIME types (default JPG, PNG, WebP, GIF)
 * @param {number|null} [props.maxSizeMB] - Largest file (null = no limit here)
 * @param {number|null} [props.maxCount] - Most images in total (null = no limit here)
 * @param {boolean} [props.canAdd] - false = only removing (e.g. the feature is off)
 * @param {boolean} [props.disabled]
 * @param {string} [props.label] - Names the add button and the images for screen readers
 * @param {string} [props.error] - From the parent (e.g. the server)
 */
const ImageUploader = ({
  images,
  onAdd,
  onRemove,
  accept = Object.keys(IMAGE_LABELS),
  maxSizeMB = null,
  maxCount = null,
  canAdd = true,
  disabled = false,
  label = 'images',
  error = '',
}) => {
  const inputRef = useRef(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejected, setRejected] = useState('');

  const isFull = maxCount !== null && images.length >= maxCount;
  const canPick = canAdd && !disabled && !isFull;

  const addFiles = (fileList) => {
    if (!canPick) return;
    const problems = [];
    const valid = [];
    for (const file of Array.from(fileList)) {
      if (!accept.includes(file.type)) problems.push(`${file.name}: only ${listNames(accept)} images`);
      else if (maxSizeMB !== null && file.size > maxSizeMB * 1024 * 1024) problems.push(`${file.name}: larger than ${maxSizeMB} MB`);
      else valid.push(file);
    }
    const room = maxCount === null ? valid.length : Math.max(0, maxCount - images.length);
    if (valid.length > room) problems.push(`At most ${maxCount} ${maxCount === 1 ? 'image' : 'images'} - ${valid.length - room} not added`);
    setRejected(problems.join('. '));
    if (room > 0 && valid.length > 0) onAdd(valid.slice(0, room));
  };

  const hint = [
    listNames(accept),
    maxSizeMB !== null && `up to ${maxSizeMB} MB each`,
  ].filter(Boolean).join(' · ');
  const message = error || rejected;

  return (
    <div>
      {canAdd && maxCount !== null && (
        <div className="flex justify-end mb-2">
          <UsagePill used={images.length} allowed={maxCount} label="images" title={`At most ${maxCount} ${maxCount === 1 ? 'image' : 'images'}`} />
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label={label}>
        {images.map((image) => (
          <li key={image.key} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            <img src={image.src} alt={image.name || ''} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => { setRejected(''); onRemove(image.key); }}
              disabled={disabled}
              aria-label={`Remove ${image.name || 'image'}`}
              className="absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-gray-700 shadow-sm hover:bg-white hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RemoveIcon />
            </button>
          </li>
        ))}
        {canAdd && !isFull && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (canPick) setIsDragActive(true); }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragActive(false); addFiles(e.dataTransfer.files); }}
              disabled={disabled}
              aria-label={`Add ${label}`}
              className={`flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isDragActive ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-500 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600'}`}
            >
              <AddIcon />
              <span className="font-medium">Add images</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(',')}
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
        aria-hidden="true"
        tabIndex={-1}
      />
      {canAdd && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
      {message && <p className="mt-1 text-sm text-red-600" role="alert">{message}</p>}
    </div>
  );
};

export default ImageUploader;
