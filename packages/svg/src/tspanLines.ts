/**
 * SVG has no line break: lines of text are written as one `<tspan>` per line,
 * each sent back to the anchor point by its own `x` and down by a `dy` or a
 * new `y`. This writes the `\n` the runs model stores in that shape, and
 * reads it back.
 */
import type { StyledRun } from '@weasel-js/core';
import { readLength } from './lengths';
import { trimNumber } from './transform';
import { escapeText } from './xmlEscape';

/**
 * How many lines a line-opening `<tspan>` steps down. A browser skips the
 * `dy` of a tspan holding no glyphs, so a blank line cannot be a tspan of its
 * own: it is folded into the next line's `dy`, and this says how many lines
 * that `dy` covers.
 */
export const LINES_ATTR = 'data-weasel-lines';

/** The `<text>` attribute stating its line height where its lines' pitch
 *  cannot, because a layout placed them. */
export const LINE_HEIGHT_ATTR = 'data-weasel-line-height';

/** Whether `tspan` says how many lines it steps down. */
export const statesLines = (tspan: Element): boolean => tspan.hasAttribute(LINES_ATTR);

/** A run's text, and its `<tspan>`'s attributes or `null` for bare text. */
export interface LinePiece { text: string; attrs: readonly string[] | null }

/**
 * The body of a `<text>`: each piece as a `<tspan>`, split wherever its text
 * breaks, with the first glyphs on each new line sent back to `x` and down by
 * `pitch` per line stepped. Breaks that end the text go on an empty tspan,
 * which only weasel's reader acts on.
 */
export function linesXml(pieces: readonly LinePiece[], x: number, pitch: number): string {
  let out = '';
  let pending = 0;
  let wrote = false;
  const tspan = (attrs: readonly string[], text: string): string =>
    `<tspan${attrs.map((a) => ` ${a}`).join('')}>${escapeText(text)}</tspan>`;
  const lineAttrs = (): string[] => {
    if (pending === 0) return [];
    const attrs = [`x="${trimNumber(x)}"`, `dy="${trimNumber(pending * pitch)}"`];
    // Before any text a line-opening tspan reads as no break at all, so the
    // count is stated there even when it is one.
    if (pending > 1 || !wrote) attrs.push(`${LINES_ATTR}="${pending}"`);
    pending = 0;
    return attrs;
  };
  for (const piece of pieces) {
    // `escapeText` writes a vertical tab or a form feed as a line break.
    piece.text.split(/[\n\u000B\u000C]/).forEach((line, i) => {
      if (i > 0) pending++;
      if (line === '') return;
      const attrs = [...(piece.attrs ?? []), ...lineAttrs()];
      out += piece.attrs === null && attrs.length === 0 ? escapeText(line) : tspan(attrs, line);
      wrote = true;
    });
  }
  return pending > 0 ? out + tspan(lineAttrs(), '') : out;
}

/** The line height a `<text>` has when nothing states one. */
export const DEFAULT_LINE_HEIGHT = 1.2;

/** Tracks the `y` the current line was placed at, to tell a tspan that moves
 *  down from one that only moves sideways along the same line, and how far
 *  down each new line was placed. */
export class LineTracker {
  private y: string | null;
  /** Where the current line sits, in user units. */
  private at: number;
  private readonly pitches: number[] = [];

  constructor(text: Element, private readonly onWarn: (message: string) => void) {
    this.y = text.getAttribute('y');
    this.at = readLength(text, 'y', 'y', 0, onWarn);
  }

  /** How many lines down `tspan` opens a new line, or 0 when it stays on the
   *  current one. Call once per tspan, in order. `afterText` is whether any
   *  text precedes it: the first line's own placement is not a pitch. */
  startsLine(tspan: Element, afterText: boolean): number {
    const y = tspan.getAttribute('y');
    const movedY = y != null && y !== this.y;
    if (y != null) this.y = y;
    const from = this.at;
    const dy = readLength(tspan, 'dy', 'y', 0, this.onWarn);
    this.at = (y != null ? readLength(tspan, 'y', 'y', from, this.onWarn) : from) + dy;
    if (!tspan.hasAttribute('x') || !(movedY || dy !== 0)) return 0;
    // `0` is a line a layout wrapped onto: it moves down and breaks nothing.
    const stated = Number(tspan.getAttribute(LINES_ATTR) ?? NaN);
    const lines = Number.isInteger(stated) && stated >= 0 ? stated : 1;
    if (afterText && lines > 0 && this.at > from) this.pitches.push((this.at - from) / lines);
    return lines;
  }

  /**
   * The line height the lines were pitched at, as a multiple of `fontSize`:
   * `undefined` for a single line, or for lines at the default pitch. The
   * model holds one line height, so uneven pitches give their mean, which
   * keeps the block's height.
   */
  lineHeight(fontSize: number): number | undefined {
    const { pitches } = this;
    if (pitches.length === 0 || !(fontSize > 0)) return undefined;
    const mean = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    if (pitches.some((p) => Math.abs(p - mean) > 1e-3 * fontSize)) {
      this.onWarn('<text> lines are pitched unevenly; they take the mean pitch as one line height');
    }
    const lineHeight = Math.round((mean / fontSize) * 1e6) / 1e6;
    return Math.abs(lineHeight - DEFAULT_LINE_HEIGHT) < 1e-6 ? undefined : lineHeight;
  }
}

/** Report the glyph positioning on a `<text>` or `<tspan>` that import does
 *  not read: every value after the first in an `x` or `y` list, a `rotate`
 *  that is not all zeros, and such a `dx` on a `<text>`. A `<tspan dx>` is
 *  read, by `placeTspanRun`. */
export function warnUnreadPositions(el: Element, onWarn: (message: string) => void): void {
  const tag = el.tagName.toLowerCase();
  for (const name of ['x', 'y']) {
    const raw = el.getAttribute(name)?.trim() ?? '';
    if (/[\s,]/.test(raw)) onWarn(`<${tag} ${name}="${raw}"> positions each glyph; only the first value is read`);
  }
  for (const name of tag === 'tspan' ? ['rotate'] : ['dx', 'rotate']) {
    const raw = el.getAttribute(name)?.trim() ?? '';
    if (raw.split(/[\s,]+/).some((v) => parseFloat(v) !== 0 && v !== '')) {
      onWarn(`<${tag} ${name}="${raw}"> is not read; the glyphs keep their own advance and angle`);
    }
  }
}

/** Whether two runs differ in nothing but their text. */
function sameStyle(a: StyledRun, b: StyledRun): boolean {
  const style = (run: StyledRun): string => JSON.stringify(
    Object.entries(run).filter(([k, v]) => k !== 'text' && v !== undefined).sort(([j], [k]) => (j < k ? -1 : 1)),
  );
  return style(a) === style(b);
}

/**
 * The lines' runs as one list, each line after the first opening with `\n`.
 * A line left with no runs still counts: it is a blank line, and `leading` is
 * how many of those open the text. A line that opens in the style the last one
 * closed in continues that run, since a run broken across lines is written as
 * a tspan per line.
 */
export function joinLines(lines: StyledRun[][], leading = 0): StyledRun[] {
  const out: StyledRun[] = [];
  let breaks = leading;
  for (const line of lines) {
    if (line.length > 0) {
      const [first, ...rest] = line;
      const head = breaks > 0 ? { ...first, text: '\n'.repeat(breaks) + first.text } : first;
      const last = out[out.length - 1];
      if (breaks > 0 && last && sameStyle(last, head)) {
        out[out.length - 1] = { ...last, text: last.text + head.text };
      } else {
        out.push(head);
      }
      out.push(...rest);
      breaks = 0;
    }
    if (out.length > 0) breaks++;
  }
  return out;
}
