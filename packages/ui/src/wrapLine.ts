import type { ReorderLine } from './useReorderDragList';

// Far wider than any line of rows, so every position on one line sorts before the next line's.
const STRIDE = 1e6;

interface Line { top: number; mid: number }

function linesOf(rows: readonly Element[]): Line[] {
  const lines: Line[] = [];
  for (const el of rows) {
    const r = el.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    const line = lines.find((l) => Math.abs(l.mid - mid) < r.height / 2);
    if (line) line.top = Math.min(line.top, r.top);
    else lines.push({ top: r.top, mid });
  }
  return lines.sort((a, b) => a.mid - b.mid);
}

/** A client x as a distance along a line read in the rows' inline direction. */
function alongLine(rows: readonly Element[]): (x: number) => number {
  const first = rows[0];
  return first && getComputedStyle(first).direction === 'rtl' ? (x) => STRIDE / 2 - x : (x) => x;
}

/**
 * The {@link ReorderLine} of rows that wrap, as chips in a flex row do: each line follows the one above it, read
 * in the rows' inline direction, and a pointer is on the lowest line whose top it is below. `rows` lists the rows
 * as the list measures them.
 */
export function wrapLine(rows: () => readonly Element[]): ReorderLine {
  const lineAt = (lines: readonly Line[], mid: number): number => {
    let at = 0;
    lines.forEach((l, i) => { if (mid >= l.top) at = i; });
    return at;
  };
  return {
    row: (el) => {
      const r = el.getBoundingClientRect();
      const all = rows();
      const lines = linesOf(all);
      const mid = r.top + r.height / 2;
      const at = lines.findIndex((l) => Math.abs(l.mid - mid) < r.height / 2);
      const along = alongLine(all);
      return { start: Math.max(at, 0) * STRIDE + Math.min(along(r.left), along(r.right)), length: r.width };
    },
    pointer: ({ clientX, clientY }) => {
      const all = rows();
      return lineAt(linesOf(all), clientY) * STRIDE + alongLine(all)(clientX);
    },
  };
}
