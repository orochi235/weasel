/**
 * Wrap-aware text measurement for a 2D context. Lines end where `layoutRuns`
 * ends them, with widths from `ctx.measureText` plus tracking. A word wider
 * than `maxWidth` is emitted on its own line unbroken.
 *
 * `lineStarts` is the UTF-16 offset of each line's first character in `text`.
 * Trailing spaces and tabs hang and are not included in `lines[i]`; neither is
 * the hard break that closed it.
 *
 * A tab runs to its next stop and `fillText` draws one as a single space, so
 * paint a line from `spans[i]` and not from `lines[i]`.
 *
 * A line wrapped at a soft hyphen ends in U+2010 in place of it, which
 * `fillText` would otherwise draw as nothing.
 *
 * The caller owns the `ctx.font` setup — pass a context whose `font`
 * already matches `style` (use `fontString(style)`).
 */

import type { ResolvedTextStyle } from '../textStyle';
import { graphemeCount } from './graphemes';
import { endsHyphenated, hangs, wrapLines, type HyphenWidth } from '../layout/lineBreak/wrapLines';
import { widthWithTabs, type TabStop } from '../layout/tabStops';

/**
 * Advance width of `text` in world units, tracking included.
 *
 * `letter-spacing` is not part of the CSS `font` shorthand, so `ctx` measures
 * glyphs only. `letterSpacing` is added after every grapheme cluster
 * including the last, as `layoutRuns` does — every 2D-side width has to go
 * through here or the two paths disagree about where a line breaks.
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

const HYPHEN = '\u2010';

/** Wrap `text` against `maxWidth` at the break opportunities `layoutRuns` wraps at, measuring with `ctx`. */
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

  const hyphenOf: HyphenWidth = (start, k) =>
    measuredWidth(ctx, text.slice(at[start], at[k]) + HYPHEN, style) - flatWidth(start, k + 1);
  const wrapped = wrapLines(cps, maxWidth, (start, end) => widthOf(start, end), hyphenOf);
  const lines: string[] = [];
  const spans: MeasuredSpan[][] = [];
  for (const l of wrapped) {
    let end = l.end;
    while (end > l.start && hangs(cps[end - 1])) end--;
    const hyphenated = endsHyphenated(cps, l.end, l.wrapped);
    const drawn = (from: number, to: number): string => (hyphenated && to === end
      ? text.slice(at[from], at[to - 1]) + HYPHEN
      : text.slice(at[from], at[to]));
    lines.push(drawn(l.start, end));
    const row: MeasuredSpan[] = [];
    widthOf(l.start, end, (from, to, x) => row.push({ text: drawn(from, to), x }));
    spans.push(row);
  }
  const lineStarts = wrapped.map((l) => at[l.start]);
  const height = lines.length * style.fontSize * style.lineHeight;
  return { lines, spans, lineStarts, height };
}
