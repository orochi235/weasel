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
