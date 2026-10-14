/**
 * SVG has no line break: wrapped text is written as one `<tspan>` per line,
 * each sent back to the left edge by its own `x` and down by a `dy` or a new
 * `y`. This reads that shape back into the `\n` the runs model stores.
 */
import type { StyledRun } from '@weasel-js/core';
import { readLength } from './lengths';

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

  /** Whether `tspan` opens a new line. Call once per tspan, in order.
   *  `afterText` is whether any text precedes it: the first line's own
   *  placement is not a pitch. */
  startsLine(tspan: Element, afterText: boolean): boolean {
    const y = tspan.getAttribute('y');
    const movedY = y != null && y !== this.y;
    if (y != null) this.y = y;
    const from = this.at;
    const dy = readLength(tspan, 'dy', 'y', 0, this.onWarn);
    this.at = (y != null ? readLength(tspan, 'y', 'y', from, this.onWarn) : from) + dy;
    if (!tspan.hasAttribute('x')) return false;
    const starts = movedY || dy !== 0;
    if (starts && afterText && this.at > from) this.pitches.push(this.at - from);
    return starts;
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
    const lineHeight = mean / fontSize;
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

/** The lines' runs as one list, each line after the first opening with `\n`.
 *  A line left with no runs still counts: it is a blank line. */
export function joinLines(lines: StyledRun[][]): StyledRun[] {
  const out: StyledRun[] = [];
  let breaks = 0;
  for (const line of lines) {
    if (line.length > 0) {
      if (breaks > 0) line[0] = { ...line[0], text: '\n'.repeat(breaks) + line[0].text };
      out.push(...line);
      breaks = 0;
    }
    if (out.length > 0) breaks++;
  }
  return out;
}
