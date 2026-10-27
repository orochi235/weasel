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

/** The `<text>` attribute stating its line height, which its lines' pitch
 *  cannot where there is one line or a layout placed them. */
export const LINE_HEIGHT_ATTR = 'data-weasel-line-height';

/** Whether weasel wrote `text`: it states the box, which no other writer does. */
export const writtenByWeasel = (text: Element): boolean => text.hasAttribute('data-weasel-width');

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

/** Tracks the pen's `y` through a `<text>`: where the current line's baseline
 *  is, how far a glyph moved off it, and how far down each new line was
 *  placed. */
export class LineTracker {
  /** The current line's baseline, in user units. */
  private lineY: number;
  /** Where the pen is, in user units. */
  private at: number;
  private readonly pitches: number[] = [];
  /** The first line's baseline, once a glyph has landed on it. */
  private first: number | undefined;
  /** Whether the text opens with blank lines it states, below the text's `y`. */
  private keepsTop = false;

  constructor(text: Element, private readonly onWarn: (message: string) => void) {
    this.at = this.lineY = readLength(text, 'y', 'y', 0, onWarn);
  }

  /** How far the pen sits above the current line's baseline, in user units. */
  get rise(): number { return this.lineY - this.at; }

  /** Move the pen to `y`, when given, and then down by `dy`. */
  move(y: number | undefined, dy: number): void { this.at = (y ?? this.at) + dy; }

  /** Say that `glyph` sits at the pen. The first glyph that is not white
   *  space settles the first line where it sits, wherever the text's `y` was:
   *  a line is placed by its glyphs. */
  land(glyph: string): void {
    if (this.first !== undefined || /^\s$/u.test(glyph)) return;
    if (!this.keepsTop) this.lineY = this.at;
    this.first = this.lineY;
  }

  /** The baseline the box's first line sits on: the text's `y` where the text
   *  opens with blank lines it states, otherwise where the first glyph landed.
   *  `undefined` before any glyph has. */
  get firstBaseline(): number | undefined { return this.keepsTop ? undefined : this.first; }

  /** How many lines down `tspan` opens a new line, or 0 when it stays on the
   *  current one. A tspan opens one when it has its own `x` and puts the pen
   *  off the line's baseline; without an `x` it only moves its glyphs off the
   *  line. `inherited` is the enclosing `<text>`'s `y` and `dy` for the
   *  tspan's first glyph, used where the tspan has none of its own. Call once
   *  per tspan, in order. `afterText` is whether any text precedes it: the
   *  first line's own placement is not a pitch. */
  startsLine(tspan: Element, afterText: boolean, inherited: { y?: number; dy?: number } = {}): number {
    const from = this.lineY;
    const y = tspan.hasAttribute('y') ? readLength(tspan, 'y', 'y', this.at, this.onWarn) : inherited.y;
    const dy = tspan.hasAttribute('dy') ? readLength(tspan, 'dy', 'y', 0, this.onWarn) : inherited.dy ?? 0;
    this.move(y, dy);
    if (!afterText && this.first === undefined && statesLines(tspan)) this.keepsTop = true;
    if (!tspan.hasAttribute('x') || Math.abs(this.at - from) < 1e-9) return 0;
    this.lineY = this.at;
    // `0` is a line a layout wrapped onto: it moves down and breaks nothing.
    const stated = Number(tspan.getAttribute(LINES_ATTR) ?? NaN);
    const lines = Number.isInteger(stated) && stated >= 0 ? stated : 1;
    if (afterText && lines > 0 && this.at > from) this.pitches.push((this.at - from) / lines);
    return lines;
  }

  /**
   * The line height the lines were pitched at, as a multiple of `fontSize`:
   * `stated` for a single line or for lines pitched as it says, otherwise
   * `undefined` at the default pitch. The model holds one line height, so
   * uneven pitches give their mean, which keeps the block's height.
   */
  lineHeight(fontSize: number, stated?: number): number | undefined {
    const { pitches } = this;
    if (pitches.length === 0 || !(fontSize > 0)) return stated;
    const mean = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
    if (pitches.some((p) => Math.abs(p - mean) > 1e-3 * fontSize)) {
      this.onWarn('<text> lines are pitched unevenly; they take the mean pitch as one line height');
    }
    if (stated !== undefined && Math.abs(mean - stated * fontSize) <= 1e-3 * fontSize) return stated;
    const lineHeight = Math.round((mean / fontSize) * 1e6) / 1e6;
    return Math.abs(lineHeight - DEFAULT_LINE_HEIGHT) < 1e-6 ? undefined : lineHeight;
  }
}

/** Whether `el` holds no element, only text. */
export const holdsOnlyText = (el: Element): boolean =>
  !Array.from(el.childNodes).some((child) => child.nodeType === 1 /* ELEMENT_NODE */);

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
