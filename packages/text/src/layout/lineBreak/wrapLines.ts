/**
 * The greedy wrap every text layout in this package shares: each measures its
 * own way and hands the measuring in here, so where a line ends is decided in
 * one place.
 */

import { isHardLineBreak, lineBreakOpportunities, lineBreakOpportunitiesInto, NO_BREAK } from './lineBreaks';

/** One line of a wrap, as code point indices into the wrapped sequence. */
export interface WrappedLine {
  /** First code point on the line. */
  start: number;
  /** One past the last, excluding the hard break that closed it. Trailing spaces are included. */
  end: number;
  /** Closed by the wrap rather than by a hard break or the end of the text. */
  wrapped: boolean;
}

/** White space that hangs at a line's end and never opens a wrapped line: a
 *  space or a tab. */
export const hangs = (cp: number): boolean => cp === 32 || cp === 9;

/**
 * Greedy wrap of `cps` at its UAX #14 break opportunities. A line ends at
 * every hard break (CRLF counts once, and neither code point lands on a
 * line), and before any word — the text up to the next opportunity, spaces
 * after it included — whose ink would take the line past `maxWidth`. Only
 * ink has to fit: trailing spaces and tabs hang. A word wider than the line is never
 * split. `Infinity` breaks at hard breaks alone.
 *
 * `widthOf(start, end)` is the width of code points `[start, end)` set on a
 * line of their own starting at `start`; `end` is always one past a
 * non-space, non-tab.
 */
export function wrapLines(
  cps: ArrayLike<number>,
  maxWidth: number,
  widthOf: (start: number, end: number) => number,
): WrappedLine[] {
  const lines: WrappedLine[] = [];
  wrapSpans(cps, maxWidth, widthOf, (start, end, wrapped) => { lines.push({ start, end, wrapped }); });
  return lines;
}

/** The opportunities of the wrap under way, kept for the next. A wrap that
 *  starts inside another's `widthOf` or `emit` finds them taken and builds its own. */
let breakScratch = new Uint8Array(64);
let breakScratchTaken = false;
/** Code points past which a wrap builds its own opportunities rather than
 *  growing the shared ones for good. */
const BREAK_SCRATCH_MAX = 1 << 16;

/** {@link wrapLines}, handing each line to `emit` in order rather than
 *  building an object for it. */
export function wrapSpans(
  cps: ArrayLike<number>,
  maxWidth: number,
  widthOf: (start: number, end: number) => number,
  emit: (start: number, end: number, wrapped: boolean) => void,
): void {
  const n = cps.length;
  if (!Number.isFinite(maxWidth)) {
    wrapAt(cps, maxWidth, widthOf, emit, null);
  } else if (breakScratchTaken || n >= BREAK_SCRATCH_MAX) {
    wrapAt(cps, maxWidth, widthOf, emit, lineBreakOpportunities(cps));
  } else {
    if (breakScratch.length < n + 1) breakScratch = new Uint8Array(Math.max(n + 1, breakScratch.length * 2));
    breakScratchTaken = true;
    try {
      wrapAt(cps, maxWidth, widthOf, emit, lineBreakOpportunitiesInto(cps, breakScratch));
    } finally {
      breakScratchTaken = false;
    }
  }
}

function wrapAt(
  cps: ArrayLike<number>,
  maxWidth: number,
  widthOf: (start: number, end: number) => number,
  emit: (start: number, end: number, wrapped: boolean) => void,
  breaks: Uint8Array | null,
): void {
  const n = cps.length;
  let start = 0;
  let i = 0;
  while (i < n) {
    const cp = cps[i];
    if (isHardLineBreak(cp)) {
      emit(start, i, false);
      i += cp === 13 && cps[i + 1] === 10 ? 2 : 1;
      start = i;
      continue;
    }
    // A space here opens the text or follows a hard break: it never wraps.
    if (hangs(cp)) { i++; continue; }
    let j = i + 1;
    let ink = i + 1;
    while (j < n && !isHardLineBreak(cps[j]) && (!breaks || breaks[j] === NO_BREAK)) {
      if (!hangs(cps[j])) ink = j + 1;
      j++;
    }
    if (breaks && i > start && widthOf(start, ink) > maxWidth) {
      emit(start, i, true);
      start = i;
    }
    i = j;
  }
  if (start < n) emit(start, n, false);
}
