/**
 * The greedy wrap every text layout in this package shares: `layoutRuns`,
 * `layoutMarkdown` and `measureText` each measure their own way and hand the
 * measuring in here, so where a line ends is decided in one place.
 */

import { isHardLineBreak, lineBreakOpportunities, NO_BREAK } from './lineBreaks';

/** One line of a wrap, as code point indices into the wrapped sequence. */
export interface WrappedLine {
  /** First code point on the line. */
  start: number;
  /** One past the last, excluding the hard break that closed it. Trailing spaces are included. */
  end: number;
  /** Closed by the wrap rather than by a hard break or the end of the text. */
  wrapped: boolean;
}

const SPACE = 32;

/**
 * Greedy wrap of `cps` at its UAX #14 break opportunities. A line ends at
 * every hard break (CRLF counts once, and neither code point lands on a
 * line), and before any word — the text up to the next opportunity, spaces
 * after it included — whose ink would take the line past `maxWidth`. Only
 * ink has to fit: trailing spaces hang. A word wider than the line is never
 * split. `Infinity` breaks at hard breaks alone.
 *
 * `widthOf(start, end)` is the width of code points `[start, end)` set on a
 * line of their own starting at `start`; `end` is always one past a
 * non-space.
 */
export function wrapLines(
  cps: ArrayLike<number>,
  maxWidth: number,
  widthOf: (start: number, end: number) => number,
): WrappedLine[] {
  const n = cps.length;
  const breaks = Number.isFinite(maxWidth) ? lineBreakOpportunities(cps) : null;
  const lines: WrappedLine[] = [];
  let start = 0;
  let i = 0;
  while (i < n) {
    const cp = cps[i];
    if (isHardLineBreak(cp)) {
      lines.push({ start, end: i, wrapped: false });
      i += cp === 13 && cps[i + 1] === 10 ? 2 : 1;
      start = i;
      continue;
    }
    // A space here opens the text or follows a hard break: it never wraps.
    if (cp === SPACE) { i++; continue; }
    let j = i + 1;
    let ink = i + 1;
    while (j < n && !isHardLineBreak(cps[j]) && (!breaks || breaks[j] === NO_BREAK)) {
      if (cps[j] !== SPACE) ink = j + 1;
      j++;
    }
    if (breaks && i > start && widthOf(start, ink) > maxWidth) {
      lines.push({ start, end: i, wrapped: true });
      start = i;
    }
    i = j;
  }
  if (start < n) lines.push({ start, end: n, wrapped: false });
  return lines;
}
