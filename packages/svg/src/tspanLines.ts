/**
 * SVG has no line break: wrapped text is written as one `<tspan>` per line,
 * each sent back to the left edge by its own `x` and down by a `dy` or a new
 * `y`. This reads that shape back into the `\n` the runs model stores.
 */
import type { StyledRun } from '@weasel-js/core';

/** Tracks the `y` the current line was placed at, to tell a tspan that moves
 *  down from one that only moves sideways along the same line. */
export class LineTracker {
  private y: string | null;

  constructor(text: Element) {
    this.y = text.getAttribute('y');
  }

  /** Whether `tspan` opens a new line. Call once per tspan, in order. */
  startsLine(tspan: Element): boolean {
    const y = tspan.getAttribute('y');
    const movedY = y != null && y !== this.y;
    if (y != null) this.y = y;
    if (!tspan.hasAttribute('x')) return false;
    const dy = parseFloat(tspan.getAttribute('dy') ?? '');
    return movedY || (Number.isFinite(dy) && dy !== 0);
  }
}

/** Report the glyph positioning on a `<text>` or `<tspan>` that import does
 *  not read: every value after the first in an `x` or `y` list, and any `dx`
 *  or `rotate` that is not all zeros. */
export function warnUnreadPositions(el: Element, onWarn: (message: string) => void): void {
  const tag = el.tagName.toLowerCase();
  for (const name of ['x', 'y']) {
    const raw = el.getAttribute(name)?.trim() ?? '';
    if (/[\s,]/.test(raw)) onWarn(`<${tag} ${name}="${raw}"> positions each glyph; only the first value is read`);
  }
  for (const name of ['dx', 'rotate']) {
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
