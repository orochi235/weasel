/**
 * Wrap-aware text measurement for a 2D context. Lines end where `layoutRuns`
 * ends them — at UAX #14 break opportunities when a word would overflow
 * `maxWidth`, and at every hard break — through the same `wrapLines`, with
 * widths from `ctx.measureText` plus tracking. A word wider than `maxWidth`
 * is emitted on its own line unbroken (caller can decide to clip).
 *
 * Returns the laid-out lines, the total block height in world units
 * (`lines.length * fontSize * lineHeight`), and per-line `lineStarts` —
 * the UTF-16 offset of each line's first character in `text`, which
 * `caretIndexAt` uses to map a clicked (x, y) back to a source offset.
 * Trailing spaces and tabs hang and are not included in `lines[i]`; neither is the
 * hard break that closed it.
 *
 * A tab runs to its next stop, as in `layoutRuns`, and `fillText` draws one as
 * a single space. So paint a line from `spans[i]`, its stretches between tabs
 * and the x each starts at, and not from `lines[i]`.
 *
 * The caller owns the `ctx.font` setup — pass a context whose `font`
 * already matches `style` (use `fontString(style)`).
 */

import type { ResolvedTextStyle } from '../textStyle';
import { graphemeCount } from './graphemes';
import { hangs, wrapLines } from '../layout/lineBreak/wrapLines';
import { widthWithTabs, type TabStop } from '../layout/tabStops';

/**
 * Advance width of `text` in world units, tracking included.
 *
 * `letter-spacing` is not part of the CSS `font` shorthand, so a context
 * whose `font` was set from `fontString(style)` measures glyphs only. The
 * GL path (`layoutRuns`) adds `letterSpacing` after every grapheme cluster
 * including the last, matching CSS, so this does too — and every 2D-side
 * width has to go through here or the two paths disagree about where a line
 * breaks.
 */
export function measuredWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: ResolvedTextStyle,
): number {
  return ctx.measureText(text).width
    + (style.letterSpacing === 0 ? 0 : graphemeCount(text) * style.letterSpacing);
}

/** A stretch of a line between tabs, and how far into the line it starts. */
export interface MeasuredSpan {
  text: string;
  x: number;
}

/** Result of `measureText`: wrapped lines, per-line source offsets, and total block height. */
export interface MeasuredText {
  lines: string[];
  /** Per line, what to paint and where: its text split at its tabs. */
  spans: MeasuredSpan[][];
  lineStarts: number[];
  height: number;
}

/**
 * Wrap `text` against `maxWidth` at the break opportunities `layoutRuns`
 * wraps at, measuring with `ctx`.
 */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  style: ResolvedTextStyle,
): MeasuredText {
  const cps: number[] = [];
  /** UTF-16 offset of each code point, then `text.length`. */
  const at: number[] = [];
  let u = 0;
  for (const ch of text) {
    cps.push(ch.codePointAt(0)!);
    at.push(u);
    u += ch.length;
  }
  at.push(u);

  const flatWidth = (start: number, end: number): number =>
    measuredWidth(ctx, text.slice(at[start], at[end]), style);
  const tabs: number[] = [];
  cps.forEach((cp, k) => { if (cp === 9) tabs.push(k); });
  const space = tabs.length === 0 ? 0 : ctx.measureText(' ').width;
  const tab: TabStop = { stop: style.tabSize * (space + style.letterSpacing), min: space / 2 };
  const widthOf = (
    start: number, end: number, piece?: (start: number, end: number, x: number) => void,
  ): number => widthWithTabs(start, end, tabs, () => tab, flatWidth, piece);

  const wrapped = wrapLines(cps, maxWidth, (start, end) => widthOf(start, end));
  const lines: string[] = [];
  const spans: MeasuredSpan[][] = [];
  for (const l of wrapped) {
    let end = l.end;
    while (end > l.start && hangs(cps[end - 1])) end--;
    lines.push(text.slice(at[l.start], at[end]));
    const row: MeasuredSpan[] = [];
    widthOf(l.start, end, (from, to, x) => row.push({ text: text.slice(at[from], at[to]), x }));
    spans.push(row);
  }
  const lineStarts = wrapped.map((l) => at[l.start]);
  const height = lines.length * style.fontSize * style.lineHeight;
  return { lines, spans, lineStarts, height };
}
