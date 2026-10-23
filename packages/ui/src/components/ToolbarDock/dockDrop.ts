import { moveBar, type BarTarget, type DockBar, type DockSpec, type ToolbarLayout } from './layout';

/** Marks the element a dock draws round each bar, holding the bar's id. */
export const DOCK_BAR = 'data-dock-bar';

/** Where a drag would drop a bar: beside a bar in a row, or as a new row at `row` of `dock`. */
export type DockDropMark = { bar: string; side: 'before' | 'after' } | { dock: string; row: number };

/** A dock row as measured at a drag's start: its extent across the dock, and the middle of each bar along it. */
interface RowBox {
  start: number;
  end: number;
  bars: { id: string; at: number }[];
}

/** A dock as measured at a drag's start. */
export interface DockBox {
  id: string;
  vertical: boolean;
  along: readonly [number, number];
  rows: RowBox[];
}

/** A point on screen, as a pointer event carries it. */
export interface DockPoint {
  clientX: number;
  clientY: number;
}

const isVertical = (spec: DockSpec | undefined) => spec?.edge === 'left' || spec?.edge === 'right';

/** The boxes of every dock drawn under `root`, and of its rows and bars. */
export function measureDocks(root: HTMLElement, docks: readonly DockSpec[]): DockBox[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-dock]'), (el) => {
    const id = el.getAttribute('data-dock')!;
    const vertical = isVertical(docks.find((d) => d.id === id));
    const box = el.getBoundingClientRect();
    const rows = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-dock-row]'), (row) => {
      const r = row.getBoundingClientRect();
      const bars = Array.from(row.querySelectorAll<HTMLElement>(`:scope > [${DOCK_BAR}]`), (bar) => {
        const b = bar.getBoundingClientRect();
        return { id: bar.getAttribute(DOCK_BAR)!, at: vertical ? b.top + b.height / 2 : b.left + b.width / 2 };
      });
      return vertical ? { start: r.left, end: r.right, bars } : { start: r.top, end: r.bottom, bars };
    });
    return { id, vertical, along: vertical ? [box.top, box.bottom] : [box.left, box.right], rows } as DockBox;
  });
}

/**
 * Where `bar` drops with the pointer at `p`: the row under the pointer, at the slot its bars' middles put it in, or a
 * new row where the pointer is within half a row beyond a dock's first or last. Null over no dock, or over one the
 * bar may not enter.
 */
export function dropAt(boxes: readonly DockBox[], bar: DockBar, p: DockPoint): { target: BarTarget; mark: DockDropMark | null } | null {
  for (const dock of boxes) {
    const along = dock.vertical ? p.clientY : p.clientX;
    const cross = dock.vertical ? p.clientX : p.clientY;
    const first = dock.rows[0];
    const last = dock.rows.at(-1);
    if (!first || !last || along < dock.along[0] || along > dock.along[1]) continue;
    if (cross < first.start - (first.end - first.start) / 2 || cross > last.end + (last.end - last.start) / 2) continue;
    if (!bar.docks.includes(dock.id)) return null;
    if (cross < first.start || cross >= last.end) {
      const row = cross < first.start ? 0 : dock.rows.length;
      return { target: { dock: dock.id, row, index: 0, newRow: true }, mark: { dock: dock.id, row } };
    }
    let row = 0;
    while (row + 1 < dock.rows.length && dock.rows[row + 1]!.start <= cross) row++;
    const others = dock.rows[row]!.bars.filter((b) => b.id !== bar.id);
    const backward = others.length > 1 && others.at(-1)!.at < others[0]!.at;
    const index = others.filter((b) => (backward ? b.at > along : b.at < along)).length;
    const beside = others[index] ?? others.at(-1);
    const mark = beside ? { bar: beside.id, side: index < others.length ? ('before' as const) : ('after' as const) } : null;
    return { target: { dock: dock.id, row, index }, mark };
  }
  return null;
}

/** `layout` with `barId` moved to `to`, or null where that changes nothing. */
export function movedLayout(layout: ToolbarLayout, barId: string, to: BarTarget): ToolbarLayout | null {
  const next = moveBar(layout, barId, to);
  return JSON.stringify(next) === JSON.stringify(layout) ? null : next;
}

/** Where a bar sits among the docks, or null for one that floats. */
export function locateBar(layout: ToolbarLayout, barId: string): { dock: string; row: number; index: number } | null {
  for (const [dock, rows] of Object.entries(layout.docks)) {
    for (const [row, ids] of rows.entries()) {
      const index = ids.indexOf(barId);
      if (index >= 0) return { dock, row, index };
    }
  }
  return null;
}

/**
 * Where Alt+`key` sends `bar`: one slot along its row for Left and Right; for Up and Down the previous or next row of
 * its dock at the same index, and past the first or last row the end of the last row of the previous or next dock it
 * may sit in. Null where it has nowhere to go.
 */
export function keyTarget(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar, key: string): BarTarget | null {
  const at = locateBar(layout, bar.id);
  if (!at) return null;
  const rows = layout.docks[at.dock]!;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const index = at.index + (key === 'ArrowLeft' ? -1 : 1);
    return index < 0 || index >= rows[at.row]!.length ? null : { ...at, index };
  }
  const step = key === 'ArrowUp' ? -1 : 1;
  const row = rows[at.row + step];
  if (row) return { dock: at.dock, row: at.row + step, index: Math.min(at.index, row.length) };
  const allowed = docks.filter((d) => bar.docks.includes(d.id)).map((d) => d.id);
  const dock = allowed[allowed.indexOf(at.dock) + step];
  if (dock === undefined) return null;
  const into = layout.docks[dock] ?? [];
  return { dock, row: Math.max(0, into.length - 1), index: into.at(-1)?.length ?? 0 };
}

/** What the dock announces after a keyboard move: where the bar landed. */
export function placeWords(layout: ToolbarLayout, bar: DockBar): string {
  const at = locateBar(layout, bar.id);
  if (!at) return '';
  return `${bar.label} toolbar, row ${at.row + 1}, position ${at.index + 1} of ${layout.docks[at.dock]![at.row]!.length}`;
}
