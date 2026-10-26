import { toCanvas } from 'html-to-image';
import { PX_PER_MM } from './layoutConstants';

// Saves drawn pages (LayoutPage) as PNG / JPEG files or one PDF. Each page is
// drawn into an image at about 200 dpi; the PDF holds one per page at the
// paper's exact size. (The browser's Print -> "Save as PDF" keeps text sharp.)

const TARGET_DPI = 200;
// Browsers refuse very large canvases; huge custom papers get fewer dpi.
const MAX_SIDE_PX = 8000;
const PT_PER_MM = 72 / 25.4;

export const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'PNG image' },
  { value: 'jpeg', label: 'JPEG image' },
];

const drawPage = (node, paper) => {
  const scale = Math.min(TARGET_DPI / 96, MAX_SIDE_PX / (Math.max(paper.widthMm, paper.heightMm) * PX_PER_MM));
  return toCanvas(node, { pixelRatio: scale, backgroundColor: '#ffffff', skipFonts: true, cacheBust: true });
};

const canvasBlob = (canvas, type, quality) =>
  new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be made.'))), type, quality));

/**
 * A PDF with one page per JPEG, each over the whole page (widthMm x heightMm).
 * @param {Array<{ bytes: Uint8Array, width: number, height: number }>} images
 */
const jpegsToPdf = (images, paper) => {
  const w = (paper.widthMm * PT_PER_MM).toFixed(2);
  const h = (paper.heightMm * PT_PER_MM).toFixed(2);
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = (bytes) => {
    parts.push(bytes);
    length += bytes.length;
  };
  const text = (s) => push(encoder.encode(s));
  const object = (n, body) => {
    offsets[n] = length;
    text(`${n} 0 obj\n${body}\nendobj\n`);
  };
  // Objects: 1 catalog, 2 pages, then per page: the page, its image, its contents.
  const pageObject = (i) => 3 + i * 3;
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + binary marker
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${pageObject(i)} 0 R`).join(' ')}] /Count ${images.length} >>`);
  images.forEach((image, i) => {
    const n = pageObject(i);
    object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${n + 1} 0 R >> >> /Contents ${n + 2} 0 R >>`);
    offsets[n + 1] = length;
    text(`${n + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    push(image.bytes);
    text('\nendstream\nendobj\n');
    object(n + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  const size = 3 + images.length * 3;
  const xrefAt = length;
  text(`xref\n0 ${size}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  text(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
};

const download = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** "Job order 12/3" -> "Job-order-12-3". */
const safeName = (name) => name.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'layout';

/**
 * Downloads pages as files: one PDF with every page, or one image per page
 * ("name-page-2.png" when there are several).
 * @param {HTMLElement[]} nodes - LayoutPages, at real size (not scaled)
 * @param {{ widthMm, heightMm }} paper
 * @param {'pdf'|'png'|'jpeg'} format
 * @param {string} name - The file name, without the extension
 */
export const exportPages = async (nodes, paper, format, name) => {
  const fileName = safeName(name);
  const fileOf = (i, extension) => (nodes.length > 1 ? `${fileName}-page-${i + 1}.${extension}` : `${fileName}.${extension}`);
  const images = [];
  for (let i = 0; i < nodes.length; i++) {
    const canvas = await drawPage(nodes[i], paper);
    if (format === 'png') {
      download(await canvasBlob(canvas, 'image/png'), fileOf(i, 'png'));
      continue;
    }
    const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.92);
    if (format === 'jpeg') download(jpeg, fileOf(i, 'jpg'));
    else images.push({ bytes: new Uint8Array(await jpeg.arrayBuffer()), width: canvas.width, height: canvas.height });
  }
  if (format === 'pdf') download(jpegsToPdf(images, paper), `${fileName}.pdf`);
};

/** Downloads one page as a file (see exportPages). */
export const exportPage = (node, paper, format, name) => exportPages([node], paper, format, name);
