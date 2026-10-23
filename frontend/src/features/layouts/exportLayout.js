import { toCanvas } from 'html-to-image';
import { PX_PER_MM } from './layoutConstants';

// Saves a drawn page (LayoutPage) as a PNG, JPEG or PDF file. The page is
// drawn into an image at about 200 dpi; the PDF holds that image at the
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

/** A one-page PDF showing a JPEG over the whole page (widthMm x heightMm). */
const jpegToPdf = (jpegBytes, imageWidth, imageHeight, paper) => {
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

  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4 + binary marker
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = length;
  text(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
  push(jpegBytes);
  text('\nendstream\nendobj\n');
  const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
  object(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

  const xrefAt = length;
  text(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);
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
 * Downloads the page as a file.
 * @param {HTMLElement} node - A LayoutPage, at real size (not scaled)
 * @param {{ widthMm, heightMm }} paper
 * @param {'pdf'|'png'|'jpeg'} format
 * @param {string} name - The file name, without the extension
 */
export const exportPage = async (node, paper, format, name) => {
  const canvas = await drawPage(node, paper);
  const fileName = safeName(name);
  if (format === 'png') return download(await canvasBlob(canvas, 'image/png'), `${fileName}.png`);
  const jpeg = await canvasBlob(canvas, 'image/jpeg', 0.92);
  if (format === 'jpeg') return download(jpeg, `${fileName}.jpg`);
  const bytes = new Uint8Array(await jpeg.arrayBuffer());
  return download(jpegToPdf(bytes, canvas.width, canvas.height, paper), `${fileName}.pdf`);
};
