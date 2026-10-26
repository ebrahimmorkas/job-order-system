import { fieldText } from './fieldValues';
import { bandOf } from './layoutConstants';

// How a layout prints a job order on one or more pages.
//
// - A table with a repeated row prints that row once for each item; the
//   table grows (rows grow with their text too) and everything whose top is
//   below the table's bottom moves down by as much. A rectangle or an up-down
//   line drawn around the table stretches instead.
// - The header band (top) and footer band (bottom) print on every page; the
//   rest flows between them. When it runs past the footer, a new page starts:
//   a growing table breaks between rows and repeats its rows above the
//   repeated row (its heading) on the new page; anything else that would be
//   cut moves to the new page whole (unless it is taller than a page).
//
// Everything is in millimetres from the page's top-left.

const TOL = 0.01;
const MAX_PAGES = 100;

const sum = (rows) => rows.reduce((total, row) => total + row.heightMm, 0);

/**
 * The rows a table with a repeated row prints: { colWidths, rows: [{ texts,
 * styleRow, isHead, isRepeat }], designedRowMm }. The repeated row comes once
 * per item ("-" for an empty field); rows above it are its heading. A column
 * set to hide when empty is left out when no item has a value in it.
 */
export const printedTableOf = (element, resolve, itemCount) => {
  const { table } = element;
  const { repeatRow } = table;
  const repeatCells = table.cells[repeatRow];
  const isEmptyCol = (c) => {
    const { field } = repeatCells[c];
    if (!table.hideEmptyCols?.[c] || !field) return false;
    return Array.from({ length: itemCount }, (_, i) => resolve(field, { itemIndex: i }).value).every((value) => !value);
  };
  const shownCols = Array.from({ length: table.cols }, (_, c) => c).filter((c) => !isEmptyCol(c));
  const cols = shownCols.length > 0 ? shownCols : Array.from({ length: table.cols }, (_, c) => c);
  const textOf = (cell, place) => {
    if (!cell.field) return cell.text;
    const text = fieldText(cell.field, resolve(cell.field, place));
    return place.itemIndex !== undefined && !text ? '-' : text;
  };

  const rows = [];
  table.cells.forEach((cells, r) => {
    if (r !== repeatRow) {
      rows.push({ texts: cols.map((c) => textOf(cells[c], {})), styleRow: r, isHead: r < repeatRow, isRepeat: false });
      return;
    }
    for (let i = 0; i < itemCount; i++) rows.push({ texts: cols.map((c) => textOf(cells[c], { itemIndex: i })), styleRow: r, isHead: false, isRepeat: true });
  });
  return { colWidths: cols.map((c) => table.colWidths[c]), rows, designedRowMm: element.height / table.rows };
};

// A frame: a rectangle or up-down line around a growing table (it stretches).
const encloses = (frame, table) => (frame.type === 'rectangle' || (frame.type === 'line' && frame.direction === 'vertical'))
  && frame.y <= table.y + TOL && frame.y + frame.height >= table.y + table.height - TOL
  && frame.x < table.x + table.width && frame.x + frame.width > table.x;

// A table's rows on one page, with their heights for drawing.
const tablePart = (table, rows) => ({ colWidths: table.colWidths, rows: rows.map((row) => ({ ...row, height: `${row.heightMm}mm` })) });

// A block placed on a page (y, height); a growing table with its rows there.
const pieceOf = (block, y, height, rows) => {
  const piece = { ...block.element, y, height };
  if (block.kind === 'rows') piece.printTable = tablePart(block, rows);
  return piece;
};

/**
 * The pages to print.
 * @param {{ paper: { widthMm, heightMm }, elements, headerHeightMm, footerHeightMm }} layout
 * @param {Map<string, { colWidths, rows: Array<{ texts, styleRow, isHead, isRepeat, heightMm }> }>} tables -
 *   Each growing table's rows, measured (heightMm)
 * @returns {Array<Array<Object>>} Each page's elements, in the layout's order; a
 *   growing table carries printTable ({ colWidths, rows }) with its rows on that page
 */
export const flowPages = ({ paper, elements, headerHeightMm = 0, footerHeightMm = 0 }, tables) => {
  const bands = { headerHeightMm, footerHeightMm };
  const order = new Map(elements.map((element, index) => [element.id, index]));
  const fixed = elements.filter((element) => bandOf(element, bands, paper) !== 'body')
    .map((element) => (tables.has(element.id) ? { ...element, printTable: tablePart(tables.get(element.id), tables.get(element.id).rows) } : element));
  const body = elements.filter((element) => bandOf(element, bands, paper) === 'body');

  // How much each growing table grows, and what moves down or stretches.
  const growing = body.filter((element) => tables.has(element.id))
    .map((element) => ({ element, growth: sum(tables.get(element.id).rows) - element.height }));
  let blocks = body.map((element) => {
    let shift = 0;
    let stretch = 0;
    for (const { element: table, growth } of growing) {
      if (table.id === element.id) continue;
      if (table.y + table.height <= element.y + TOL) shift += growth;
      else if (encloses(element, table)) stretch += growth;
    }
    const printed = tables.get(element.id);
    if (printed) {
      return { element, top: element.y + shift, height: sum(printed.rows), kind: 'rows', rows: printed.rows, colWidths: printed.colWidths };
    }
    return { element, top: element.y + shift, height: element.height + stretch, kind: stretch > 0 ? 'frame' : 'solid' };
  });

  const bodyTop = headerHeightMm;
  const room = paper.heightMm - footerHeightMm - bodyTop;
  const pages = [];
  let start = bodyTop;
  while (pages.length < MAX_PAGES) {
    const end = start + room;
    // Where this page ends: before whatever can't be cut there.
    let cut = end;
    for (const block of blocks) {
      if (block.top >= end - TOL || block.top + block.height <= end + TOL || block.kind === 'frame') continue;
      if (block.kind === 'rows') {
        let at = block.top;
        let lastFit = null;
        block.rows.forEach((row) => {
          at += row.heightMm;
          if (!row.isHead && at <= end + TOL) lastFit = at;
        });
        cut = Math.min(cut, lastFit !== null && lastFit > start + TOL ? lastFit : block.top);
      } else {
        cut = Math.min(cut, block.top);
      }
    }
    // Taller than a page from its top: cut through it.
    if (cut <= start + TOL) cut = end;

    const page = [];
    const next = [];
    let headingMm = 0;
    for (const block of blocks) {
      const bottom = block.top + block.height;
      if (block.top >= cut - TOL) {
        next.push(block);
        continue;
      }
      const y = block.top - start + bodyTop;
      if (bottom <= cut + TOL) {
        page.push(pieceOf(block, y, block.height, block.rows));
        continue;
      }
      if (block.kind === 'rows') {
        const here = [];
        let at = block.top;
        let i = 0;
        for (; i < block.rows.length && at + block.rows[i].heightMm <= cut + TOL; i++) {
          here.push(block.rows[i]);
          at += block.rows[i].heightMm;
        }
        // Not even one row fits on a whole page: it prints cut off.
        if (here.every((row) => row.isHead) && i < block.rows.length) {
          here.push(block.rows[i]);
          i++;
        }
        page.push(pieceOf(block, y, sum(here), here));
        const rest = block.rows.slice(i);
        if (rest.length > 0) {
          const heading = block.rows.filter((row) => row.isHead);
          headingMm = Math.max(headingMm, sum(heading));
          next.push({ ...block, top: cut, rows: [...heading, ...rest], height: sum(heading) + sum(rest), isContinued: true });
        }
      } else {
        page.push(pieceOf(block, y, cut - block.top));
        next.push({ ...block, top: cut, height: bottom - cut, isContinued: true });
      }
    }
    pages.push(page);
    if (next.length === 0) break;
    // A heading repeated on the new page pushes what follows down.
    blocks = next.map((block) => {
      if (!headingMm || (block.isContinued && block.kind === 'rows')) return block;
      return block.isContinued ? { ...block, height: block.height + headingMm } : { ...block, top: block.top + headingMm };
    });
    start = cut;
  }
  if (pages.length === 0) pages.push([]);
  return pages.map((page) => [...fixed, ...page].sort((a, b) => order.get(a.id) - order.get(b.id)));
};
