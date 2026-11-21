import type { BarPoint } from './useBarReorder';
import { BAR_ITEM, BAR_LEAD, BAR_MORE } from './useBarOverflow';

// Past any screen coordinate, so a later line's every place lies past an earlier one's.
const LINE = 1e6;

/** A line of a wrapped bar, as the span it takes across the bar's run. */
interface Band {
  from: number;
  to: number;
}

/** The lines a wrapped bar's cells lie on, as spans across its run, in the order the lines read. */
function bandsOf(root: HTMLElement, vertical: boolean, rtl: boolean): Band[] {
  const spans = Array.from(root.querySelectorAll(`:scope > [${BAR_ITEM}], :scope > [${BAR_MORE}], :scope > [${BAR_LEAD}]`), (cell) => {
    const box = cell.getBoundingClientRect();
    return vertical ? { from: box.left, to: box.right } : { from: box.top, to: box.bottom };
  }).sort((a, b) => a.from - b.from);
  const bands: Band[] = [];
  for (const span of spans) {
    const last = bands.at(-1);
    if (last && span.from < last.to) last.to = Math.max(last.to, span.to);
    else bands.push({ ...span });
  }
  // A wrapped column runs its lines from the right under right-to-left.
  return vertical && rtl ? bands.reverse() : bands;
}

/**
 * How far along a wrapped bar's lines `p` lies, read line after line: the line it is across from, nearest where it
 * is between two or past the ends, then its place along that line.
 */
export function wrappedPosition(root: HTMLElement, p: BarPoint, vertical: boolean, rtl: boolean): number {
  const bands = bandsOf(root, vertical, rtl);
  const across = vertical ? p.clientX : p.clientY;
  let line = 0;
  let best = Number.POSITIVE_INFINITY;
  for (const [i, band] of bands.entries()) {
    const off = across < band.from ? band.from - across : across > band.to ? across - band.to : 0;
    if (off < best) {
      best = off;
      line = i;
    }
  }
  const along = vertical ? p.clientY : rtl ? -p.clientX : p.clientX;
  return line * LINE + along;
}
