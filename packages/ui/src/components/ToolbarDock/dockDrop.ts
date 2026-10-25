import { dropIndex } from '../Bar/useBarReorder';
import { canEnter, isVerticalEdge, moveBar, type BarTarget, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from './layout';

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
  edge: DockEdge;
  vertical: boolean;
  along: readonly [number, number];
  rows: RowBox[];
}

/** A point on screen, as a pointer event carries it. */
export interface DockPoint {
  clientX: number;
  clientY: number;
}

/** Whether the element a dock draws round a bar holds anything: a bar drawn as nothing keeps its place but no room. */
const isDrawn = (slot: Element): boolean => slot.firstChild !== null;

/** The ids of the bars under `root` that draw something. */
export function drawnBars(root: HTMLElement): Set<string> {
  return new Set(Array.from(root.querySelectorAll(`[${DOCK_BAR}]`)).filter(isDrawn).map((el) => el.getAttribute(DOCK_BAR)!));
}

/** `layout` with only the bars in `drawn`, and `barId`, left in its rows; rows left empty stay, so row indices hold. */
export function drawnLayout(layout: ToolbarLayout, drawn: ReadonlySet<string>, barId: string): ToolbarLayout {
  const docks: ToolbarLayout['docks'] = {};
  for (const [dock, rows] of Object.entries(layout.docks)) docks[dock] = rows.map((r) => r.filter((id) => id === barId || drawn.has(id)));
  return { docks, floating: layout.floating };
}

/**
 * `to`, a slot counted among the drawn bars of its row, as a slot among all of them: before the drawn bar it names,
 * or after the last drawn bar, so bars drawn as nothing keep their places.
 */
export function spreadTarget(layout: ToolbarLayout, barId: string, to: BarTarget, drawn: ReadonlySet<string>): BarTarget {
  if ('float' in to || to.newRow) return to;
  const row = (layout.docks[to.dock]?.[to.row] ?? []).filter((id) => id !== barId);
  const shown = row.filter((id) => drawn.has(id));
  if (!shown.length) return to;
  const beside = shown[to.index];
  return { ...to, index: beside === undefined ? row.indexOf(shown.at(-1)!) + 1 : row.indexOf(beside) };
}

/** The boxes of every dock drawn under `root`, and of its rows and bars. */
export function measureDocks(root: HTMLElement, docks: readonly DockSpec[]): DockBox[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-dock]'), (el) => {
    const id = el.getAttribute('data-dock')!;
    const edge = docks.find((d) => d.id === id)?.edge ?? 'top';
    const vertical = isVerticalEdge(edge);
    const box = el.getBoundingClientRect();
    const rows = Array.from(el.querySelectorAll<HTMLElement>(':scope > [data-dock-row]'), (row) => {
      const r = row.getBoundingClientRect();
      const drawn = Array.from(row.querySelectorAll<HTMLElement>(`:scope > [${DOCK_BAR}]`)).filter(isDrawn);
      const bars = drawn.map((bar) => {
        const b = bar.getBoundingClientRect();
        return { id: bar.getAttribute(DOCK_BAR)!, at: vertical ? b.top + b.height / 2 : b.left + b.width / 2 };
      });
      return vertical ? { start: r.left, end: r.right, bars } : { start: r.top, end: r.bottom, bars };
    });
    return { id, edge, vertical, along: vertical ? [box.top, box.bottom] : [box.left, box.right], rows } as DockBox;
  });
}

/**
 * Where `bar` drops with the pointer at `p`: the row under the pointer, at the slot its bars' middles put it in, or a
 * new row where the pointer is within half a row, or `reach` if that is more, beyond a dock's first or last. A row
 * under the pointer wins over another dock's new-row zone. Null over no dock, or over one the bar may not enter.
 */
export function dropAt(boxes: readonly DockBox[], bar: DockBar, p: DockPoint, reach = 0): { target: BarTarget; mark: DockDropMark | null } | null {
  for (const dock of boxes) {
    const { along, cross } = axes(dock, p);
    if (!overRows(dock, along) || cross < dock.rows[0]!.start || cross >= dock.rows.at(-1)!.end) continue;
    if (!canEnter(bar, dock)) return null;
    let row = 0;
    while (row + 1 < dock.rows.length && dock.rows[row + 1]!.start <= cross) row++;
    const inRow = dock.rows[row]!.bars;
    const index = dropIndex(inRow, inRow.findIndex((b) => b.id === bar.id), along);
    const others = inRow.filter((b) => b.id !== bar.id);
    const beside = others[index] ?? others.at(-1);
    const mark = beside ? { bar: beside.id, side: index < others.length ? ('before' as const) : ('after' as const) } : null;
    return { target: { dock: dock.id, row, index }, mark };
  }
  for (const dock of boxes) {
    const { along, cross } = axes(dock, p);
    if (!overRows(dock, along)) continue;
    const first = dock.rows[0]!;
    const last = dock.rows.at(-1)!;
    if (cross < first.start - Math.max(reach, (first.end - first.start) / 2) || cross > last.end + Math.max(reach, (last.end - last.start) / 2)) continue;
    if (!canEnter(bar, dock)) return null;
    const row = cross < first.start ? 0 : dock.rows.length;
    return { target: { dock: dock.id, row, index: 0, newRow: true }, mark: { dock: dock.id, row } };
  }
  return null;
}

/** `p` along `dock`'s rows and across them. */
const axes = (dock: DockBox, p: DockPoint) => (dock.vertical ? { along: p.clientY, cross: p.clientX } : { along: p.clientX, cross: p.clientY });

/** Whether `dock` has rows and `along` falls within its length. */
const overRows = (dock: DockBox, along: number): boolean => dock.rows.length > 0 && along >= dock.along[0] && along <= dock.along[1];

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

/** The keys that move a bar along its row, back then on, and across rows, back then on, in a dock on `edge`. */
const keysFor = (edge: DockEdge | undefined) =>
  isVerticalEdge(edge) ? ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] : ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

/**
 * Where Alt+`key` sends `bar`. In a top or bottom dock: one slot along its row for Left and Right; for Up and Down the
 * previous or next row of its dock at the same index, and past its dock's first or last row the previous or next dock
 * it may enter: the end of that dock's last row going back, of its first row going on. A left or right dock turns
 * this a quarter: Up and Down move along the column, Left and Right across columns and docks. Null where it has
 * nowhere to go.
 */
export function keyTarget(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar, key: string): BarTarget | null {
  const at = locateBar(layout, bar.id);
  if (!at) return null;
  const rows = layout.docks[at.dock]!;
  const [alongBack, alongOn, acrossBack] = keysFor(docks.find((d) => d.id === at.dock)?.edge);
  if (key === alongBack || key === alongOn) {
    const index = at.index + (key === alongBack ? -1 : 1);
    return index < 0 || index >= rows[at.row]!.length ? null : { ...at, index };
  }
  const step = key === acrossBack ? -1 : 1;
  const row = rows[at.row + step];
  if (row) return { dock: at.dock, row: at.row + step, index: Math.min(at.index, row.length) };
  const allowed = docks.filter((d) => canEnter(bar, d)).map((d) => d.id);
  const dock = allowed[allowed.indexOf(at.dock) + step];
  if (dock === undefined) return null;
  const into = layout.docks[dock] ?? [];
  const entry = step < 0 ? Math.max(0, into.length - 1) : 0;
  return { dock, row: entry, index: into[entry]?.length ?? 0 };
}

/** What the dock announces after a keyboard move: where the bar landed, after `state` where it is given. */
export function placeWords(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar, state?: string): string {
  const at = locateBar(layout, bar.id);
  if (!at) return '';
  const name = state ? `${bar.label} toolbar ${state}` : `${bar.label} toolbar`;
  const line = isVerticalEdge(docks.find((d) => d.id === at.dock)?.edge) ? 'column' : 'row';
  return `${name}, ${line} ${at.row + 1}, position ${at.index + 1} of ${layout.docks[at.dock]![at.row]!.length}`;
}
