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

/** White space that hangs at a line's end: a space or a tab. A space never
 *  opens a wrapped line; a tab does only where UAX #14 breaks before it (after
 *  a space or a zero-width space) and ink follows it with no opportunity
 *  between. */
export const hangs = (cp: number): boolean => cp === 32 || cp === 9;

/** U+00AD: invisible unless a line wraps at it, when it draws as a hyphen. */
export const SOFT_HYPHEN = 0xad;

/** The width a line `[start, k + 1)` gains when it wraps at the soft hyphen
 *  at `k` and draws a hyphen there. */
export type HyphenWidth = (start: number, k: number) => number;

/**
 * Greedy wrap of `cps` at its UAX #14 break opportunities. A line ends at
 * every hard break (CRLF counts once, and neither code point lands on a
 * line), and before any word — the text up to the next opportunity, spaces
 * after it included — whose ink would take the line past `maxWidth`. Only
 * ink has to fit: trailing spaces and tabs hang. A word wider than the line is never
 * split. `Infinity` breaks at hard breaks alone.
 *
 * A line the wrap ends at a soft hyphen draws a hyphen there, as CSS's
 * `hyphens: manual` does, so it ends there only if it fits with
 * `hyphenOf`'s width added; else it ends at the opportunity before. A soft
 * hyphen the line runs on past adds nothing. Without `hyphenOf`, a hyphen
 * takes no room.
 *
 * `widthOf(start, end)` is the width of code points `[start, end)` set on a
 * line of their own starting at `start`; `end` is always one past a
 * non-space, non-tab.
 */
export function wrapLines(
  cps: ArrayLike<number>,
  maxWidth: number,
  widthOf: (start: number, end: number) => number,
  hyphenOf: HyphenWidth | null = null,
): WrappedLine[] {
  const lines: WrappedLine[] = [];
  wrapSpans(cps, { maxWidth }, widthOf, (start, end, wrapped) => { lines.push({ start, end, wrapped }); }, hyphenOf);
  return lines;
}

/** Whether a line wrapped to end at `end` draws a hyphen at its end. */
export const endsHyphenated = (cps: ArrayLike<number>, end: number, wrapped: boolean): boolean =>
  wrapped && end > 0 && cps[end - 1] === SOFT_HYPHEN;

/** The opportunities of the wrap under way, kept for the next. A wrap that
 *  starts inside another's `widthOf` or `emit` finds them taken and builds its own. */
let breakScratch = new Uint8Array(64);
let breakScratchTaken = false;
/** Code points past which a wrap builds its own opportunities rather than
 *  growing the shared ones for good. */
const BREAK_SCRATCH_MAX = 1 << 16;

/** {@link wrapLines}, handing each line to `emit` in order rather than
 *  building an object for it. The width comes in an object because a number
 *  passed to a call V8 does not inline is boxed on every call. */
export function wrapSpans(
  cps: ArrayLike<number>,
  box: { readonly maxWidth: number },
  widthOf: (start: number, end: number) => number,
  emit: (start: number, end: number, wrapped: boolean) => void,
  hyphenOf: HyphenWidth | null = null,
): void {
  const n = cps.length;
  if (!Number.isFinite(box.maxWidth)) {
    wrapAt(cps, box, widthOf, emit, null, hyphenOf);
  } else if (breakScratchTaken || n >= BREAK_SCRATCH_MAX) {
    wrapAt(cps, box, widthOf, emit, lineBreakOpportunities(cps), hyphenOf);
  } else {
    if (breakScratch.length < n + 1) breakScratch = new Uint8Array(Math.max(n + 1, breakScratch.length * 2));
    breakScratchTaken = true;
    try {
      wrapAt(cps, box, widthOf, emit, lineBreakOpportunitiesInto(cps, breakScratch), hyphenOf);
    } finally {
      breakScratchTaken = false;
    }
  }
}

/** How far past `maxWidth`, as a fraction of it, a line still fits: a width
 *  summed in another order than the layout's own differs from it in the last
 *  bits, and a box fitted to a line must not wrap it. */
const FIT_SLACK = 1e-9;

function wrapAt(
  cps: ArrayLike<number>,
  box: { readonly maxWidth: number },
  widthOf: (start: number, end: number) => number,
  emit: (start: number, end: number, wrapped: boolean) => void,
  breaks: Uint8Array | null,
  hyphenOf: HyphenWidth | null,
): void {
  const n = cps.length;
  const fits = box.maxWidth + Math.abs(box.maxWidth) * FIT_SLACK;
  let start = 0;
  /** The last opportunity past `start` the line can end at and fit, hyphen included. */
  let fitEnd = 0;
  let i = 0;
  while (i < n) {
    const cp = cps[i];
    if (isHardLineBreak(cp)) {
      emit(start, i, false);
      i += cp === 13 && cps[i + 1] === 10 ? 2 : 1;
      start = i;
      continue;
    }
    let j = i + 1;
    // A word of hanging white space alone has no ink to fit; a mark on a tab is ink.
    let ink = hangs(cp) ? 0 : i + 1;
    while (j < n && !isHardLineBreak(cps[j]) && (!breaks || breaks[j] === NO_BREAK)) {
      if (!hangs(cps[j])) ink = j + 1;
      j++;
    }
    if (breaks && i > start && ink > 0) {
      const w = widthOf(start, ink);
      if (w > fits) {
        // Back to the last end that fits: the words after it ran on past a
        // soft hyphen whose hyphen would not have fit, and start the next line.
        const end = fitEnd > start ? fitEnd : i;
        emit(start, end, true);
        start = end;
        if (end < i) {
          i = end;
          continue;
        }
      } else if (hyphenOf !== null && ink === j && j < n && cps[j - 1] === SOFT_HYPHEN
        && !isHardLineBreak(cps[j]) && w + hyphenOf(start, j - 1) > fits) {
        i = j;
        continue;
      }
    }
    fitEnd = j;
    i = j;
  }
  if (start < n) emit(start, n, false);
}
