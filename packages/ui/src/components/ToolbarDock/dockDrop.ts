import { setOwn } from '@weasel-js/registry';
import { gapByMidpoint } from '@weasel-js/ui-input';
import { canEnter, dockRows, isAtEnd, isVerticalEdge, moveBar, startCount, type BarTarget, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from './layout';

/** Marks the element a dock draws round each bar, holding the bar's id. */
export const DOCK_BAR = 'data-dock-bar';

/** Marks the element a bar is drawn into, which the dock moves between its slots. */
export const DOCK_HOST = 'data-dock-host';

/** Marks a dock's slot whose bar sits at the far end of its row. */
export const DOCK_END = 'data-dock-end';

/**
 * Where a drag would drop a bar: beside a bar in a row, as a new row at `row` of `dock`, or against the start or the
 * far end of a row with no bars at that end.
 */
export type DockDropMark =
  | { bar: string; side: 'before' | 'after' }
  | { dock: string; row: number }
  | { dock: string; row: number; at: 'start' | 'end' };

/**
 * A dock row as measured at a drag's start: its extent across the dock, the points along the dock where it starts
 * and ends in reading order, and the middle of each bar along it, with whether the bar sits at the row's far end.
 */
interface RowBox {
  start: number;
  end: number;
  from: number;
  to: number;
  bars: { id: string; at: number; end: boolean }[];
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
const isDrawn = (slot: Element): boolean => {
  const inner = slot.firstChild;
  return inner !== null && !(inner instanceof Element && inner.hasAttribute(DOCK_HOST) && inner.firstChild === null);
};

/** The ids of the bars under `root` that draw something. */
export function drawnBars(root: HTMLElement): Set<string> {
  return new Set(Array.from(root.querySelectorAll(`[${DOCK_BAR}]`)).filter(isDrawn).map((el) => el.getAttribute(DOCK_BAR)!));
}

/** `layout` with only the bars in `drawn`, and `barId`, left in its rows; rows left empty stay, so row indices hold. */
export function drawnLayout(layout: ToolbarLayout, drawn: ReadonlySet<string>, barId: string): ToolbarLayout {
  const docks: ToolbarLayout['docks'] = {};
  for (const [dock, rows] of Object.entries(layout.docks)) setOwn(docks, dock, rows.map((r) => r.filter((id) => id === barId || drawn.has(id))));
  return { docks, floating: layout.floating, ...(layout.atEnd ? { atEnd: layout.atEnd } : {}) };
}

/**
 * `to`, a slot counted among the drawn bars of its row, as a slot among all of them: before the drawn bar it names,
 * or after the last drawn bar, so bars drawn as nothing keep their places.
 */
export function spreadTarget(layout: ToolbarLayout, barId: string, to: BarTarget, drawn: ReadonlySet<string>): BarTarget {
  if ('float' in to || to.newRow) return to;
  const row = (dockRows(layout, to.dock)?.[to.row] ?? []).filter((id) => id !== barId);
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
        return { id: bar.getAttribute(DOCK_BAR)!, at: vertical ? b.top + b.height / 2 : b.left + b.width / 2, end: bar.hasAttribute(DOCK_END) };
      });
      if (vertical) return { start: r.left, end: r.right, from: r.top, to: r.bottom, bars };
      const rtl = getComputedStyle(row).direction === 'rtl';
      return { start: r.top, end: r.bottom, from: rtl ? r.right : r.left, to: rtl ? r.left : r.right, bars };
    });
    return { id, edge, vertical, along: vertical ? [box.top, box.bottom] : [box.left, box.right], rows } as DockBox;
  });
}

/**
 * Where `bar` drops with the pointer at `p`: the row under the pointer, at the slot its bars' middles put it in, or a
 * new row where the pointer is within half a row, or `reach` if that is more, beyond a dock's first or last. A row
 * under the pointer wins over another dock's new-row zone. In the gap between a row's start bars and its end bars,
 * or past the last of either where the other end has none, the bar joins whichever end the pointer is nearer.
 * Null over no dock, or over one the bar may not enter.
 */
export function dropAt(boxes: readonly DockBox[], bar: DockBar, p: DockPoint, reach = 0): { target: BarTarget; mark: DockDropMark | null } | null {
  for (const dock of boxes) {
    const { along, cross } = axes(dock, p);
    if (!overRows(dock, along) || cross < dock.rows[0]!.start || cross >= dock.rows.at(-1)!.end) continue;
    if (!canEnter(bar, dock)) return null;
    let row = 0;
    while (row + 1 < dock.rows.length && dock.rows[row + 1]!.start <= cross) row++;
    const box = dock.rows[row]!;
    const from = box.bars.findIndex((b) => b.id === bar.id);
    const gap = gapByMidpoint(box.bars.map((b) => b.at), along);
    const index = from >= 0 && gap > from ? gap - 1 : gap;
    const others = box.bars.filter((b) => b.id !== bar.id);
    const starts = others.filter((b) => !b.end).length;
    const near = others[starts - 1]?.at ?? box.from;
    const far = others[starts]?.at ?? box.to;
    const end = index > starts || (index === starts && Math.abs(along - far) < Math.abs(along - near));
    const target = { dock: dock.id, row, index, ...(end ? { end: true } : {}) };
    return { target, mark: rowMark(others, starts, index, end, dock.id, row) };
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

/** The mark for a drop at `index` of a row whose bars, but for the dragged one, are `others`, `starts` of them at its
 *  start: beside the bar it lands next to in the end it joins, or against that end where it has no bars. */
function rowMark(others: readonly { id: string }[], starts: number, index: number, end: boolean, dock: string, row: number): DockDropMark {
  if (index < others.length && (end || index < starts)) return { bar: others[index]!.id, side: 'before' };
  const last = end ? others.length : starts;
  const lastBar = last > (end ? starts : 0) ? others[last - 1] : undefined;
  return lastBar ? { bar: lastBar.id, side: 'after' } : { dock, row, at: end ? 'end' : 'start' };
}

/** `p` along `dock`'s rows and across them. */
const axes = (dock: DockBox, p: DockPoint) => (dock.vertical ? { along: p.clientY, cross: p.clientX } : { along: p.clientX, cross: p.clientY });

/** Whether `dock` has rows and `along` falls within its length. */
const overRows = (dock: DockBox, along: number): boolean => dock.rows.length > 0 && along >= dock.along[0] && along <= dock.along[1];

/** `layout` with `barId` moved to `to`, or null where that changes nothing. */
export function movedLayout(layout: ToolbarLayout, barId: string, to: BarTarget): ToolbarLayout | null {
  const next = moveBar(layout, barId, to);
  // eslint-disable-next-line no-restricted-syntax -- key order counts: `floating`'s is the order its bars stack in.
  return JSON.stringify(next) === JSON.stringify(layout) ? null : next;
}

/** Where a bar sits among the docks, and whether at its row's far end, or null for one that floats. */
export function locateBar(layout: ToolbarLayout, barId: string): { dock: string; row: number; index: number; end: boolean } | null {
  for (const [dock, rows] of Object.entries(layout.docks)) {
    for (const [row, ids] of rows.entries()) {
      const index = ids.indexOf(barId);
      if (index >= 0) return { dock, row, index, end: isAtEnd(layout, barId) };
    }
  }
  return null;
}

/** The keys that move a bar along its row, back then on, and across rows, back then on, in a dock on `edge`. */
const keysFor = (edge: DockEdge | undefined) =>
  isVerticalEdge(edge) ? ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] : ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

/**
 * Where Alt+`key` sends `bar`. In a top or bottom dock: one slot along its row for Left and Right, and from the last
 * of the row's start bars on, or the first of its end bars back, across the gap to the other end; for Up and Down the
 * previous or next row of its dock at the same place in the same end, and past its dock's first or last row the
 * previous or next dock it may enter: after the start bars of that dock's last row going back, of its first row going
 * on. A left or right dock turns this a quarter: Up and Down move along the column, Left and Right across columns and
 * docks. Null where it has nowhere to go.
 */
export function keyTarget(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar, key: string): BarTarget | null {
  const at = locateBar(layout, bar.id);
  if (!at) return null;
  const rows = layout.docks[at.dock]!;
  const [alongBack, alongOn, acrossBack] = keysFor(docks.find((d) => d.id === at.dock)?.edge);
  if (key === alongBack || key === alongOn) return alongTarget(layout, at, key === alongOn);
  const step = key === acrossBack ? -1 : 1;
  const row = rows[at.row + step];
  if (row) {
    const starts = startCount(layout, row);
    const index = at.end
      ? starts + Math.min(at.index - startCount(layout, rows[at.row]!), row.length - starts)
      : Math.min(at.index, starts);
    return { dock: at.dock, row: at.row + step, index, ...(at.end ? { end: true } : {}) };
  }
  const allowed = docks.filter((d) => canEnter(bar, d)).map((d) => d.id);
  const dock = allowed[allowed.indexOf(at.dock) + step];
  if (dock === undefined) return null;
  const into = dockRows(layout, dock) ?? [];
  const entry = step < 0 ? Math.max(0, into.length - 1) : 0;
  return { dock, row: entry, index: into[entry] ? startCount(layout, into[entry]) : 0 };
}

/** One slot along its row for the bar at `at`, on or back, crossing to the row's other end at the edge of its own. */
function alongTarget(layout: ToolbarLayout, at: { dock: string; row: number; index: number; end: boolean }, on: boolean): BarTarget | null {
  const row = layout.docks[at.dock]![at.row]!;
  const starts = startCount(layout, row);
  const place = { dock: at.dock, row: at.row };
  if (!at.end) {
    if (on && at.index === starts - 1) return { ...place, index: at.index, end: true };
    const index = at.index + (on ? 1 : -1);
    return index < 0 ? null : { ...place, index };
  }
  if (!on && at.index === starts) return { ...place, index: at.index };
  const index = at.index + (on ? 1 : -1);
  return index >= row.length ? null : { ...place, index, end: true };
}

/** What the dock announces after a keyboard move: where the bar landed, after `state` where it is given. */
export function placeWords(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar, state?: string): string {
  const at = locateBar(layout, bar.id);
  if (!at) return '';
  const name = state ? `${bar.label} toolbar ${state}` : `${bar.label} toolbar`;
  const line = isVerticalEdge(docks.find((d) => d.id === at.dock)?.edge) ? 'column' : 'row';
  const where = `${name}, ${line} ${at.row + 1}, position ${at.index + 1} of ${layout.docks[at.dock]![at.row]!.length}`;
  return at.end ? `${where}, at the end` : where;
}
