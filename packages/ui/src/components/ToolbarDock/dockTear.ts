import { DEFAULT_INSET } from 'windease';
import { dragPlacement, floatingItem } from '../../floating/dragPlacement';
import { DOCK_BAR, drawnBars, dropAt, locateBar, measureDocks, type DockBox, type DockDropMark, type DockPoint } from './dockDrop';
import { canEnter, homeDock, isVerticalEdge, type BarTarget, type DockBar, type DockSpec, type FloatPlace, type ToolbarLayout } from './layout';

/** How far across its dock row a docked bar is dragged before it lifts off to float, in pixels. */
export const TEAR_PX = 24;

/** Marks the strip a drag shows along an empty dock the bar may enter, holding the dock's id. */
export const DOCK_EMPTY = 'data-dock-empty';

/** An empty dock's strip, as measured once a drag has drawn it. */
interface EmptyBox {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What a handle's drag measured when it began. */
export interface DockGrab {
  boxes: DockBox[];
  drawn: Set<string>;
  /** The strips of empty docks the bar may enter; null until the drag has drawn them, a move or two after it began. */
  empties: EmptyBox[] | null;
  /** The extent across its dock of the row the bar sat in; null for a bar that floats. */
  row: { vertical: boolean; start: number; end: number } | null;
  /** The bar's place in the floating layer at the press. */
  from: FloatPlace;
  size: { w: number; h: number };
  container: { w: number; h: number };
}

/** Where a drag would put a bar now: a slot in a dock, a floating place, both for a floating bar over a dock, or neither. */
export interface DockTearStep {
  drop: { target: BarTarget; mark: DockDropMark | null } | null;
  float: FloatPlace | null;
}

const barElement = (root: HTMLElement, id: string) =>
  Array.from(root.querySelectorAll<HTMLElement>(`[${DOCK_BAR}]`)).find((el) => el.getAttribute(DOCK_BAR) === id);

/** Where the bar `id` sits in `layer` now, as a free floating place keeping `orientation`. */
export function floatHere(root: HTMLElement, layer: HTMLElement, id: string, orientation: FloatPlace['orientation']): FloatPlace {
  const r = barElement(root, id)?.getBoundingClientRect();
  const l = layer.getBoundingClientRect();
  return { x: (r?.left ?? l.left) - l.left, y: (r?.top ?? l.top) - l.top, anchor: null, orientation };
}

/** Where Alt+Enter floats a docked bar: where it is drawn, keeping its dock's orientation. Null for a bar in no dock. */
export function floatWhereDrawn(root: HTMLElement, layer: HTMLElement, layout: ToolbarLayout, docks: readonly DockSpec[], id: string): FloatPlace | null {
  const at = locateBar(layout, id);
  if (!at) return null;
  return floatHere(root, layer, id, isVerticalEdge(docks.find((d) => d.id === at.dock)?.edge) ? 'vertical' : 'horizontal');
}

/** Measures what a drag of `bar` reads: the docks, the row it sits in, and its box in `layer`. */
export function grabBar(root: HTMLElement, layer: HTMLElement, docks: readonly DockSpec[], bar: DockBar, layout: ToolbarLayout): DockGrab {
  const boxes = measureDocks(root, docks);
  let row: DockGrab['row'] = null;
  for (const dock of boxes) {
    const at = dock.rows.find((r) => r.bars.some((b) => b.id === bar.id));
    if (at) row = { vertical: dock.vertical, start: at.start, end: at.end };
  }
  const floating = layout.floating[bar.id];
  const orientation = floating?.orientation ?? (row?.vertical ? 'vertical' : 'horizontal');
  const r = barElement(root, bar.id)?.getBoundingClientRect();
  const l = layer.getBoundingClientRect();
  return {
    boxes,
    drawn: drawnBars(root),
    empties: docks.some((d) => canEnter(bar, d) && !layout.docks[d.id]?.length) ? null : [],
    row,
    from: floatHere(root, layer, bar.id, orientation),
    size: { w: r?.width ?? 0, h: r?.height ?? 0 },
    container: { w: l.width, h: l.height },
  };
}

/** The strips under `root` that mark empty docks. */
export function measureEmpties(root: HTMLElement): EmptyBox[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${DOCK_EMPTY}]`), (el) => {
    const { left, top, right, bottom } = el.getBoundingClientRect();
    return { id: el.getAttribute(DOCK_EMPTY)!, left, top, right, bottom };
  });
}

function emptyDropAt(empties: readonly EmptyBox[], p: DockPoint): DockTearStep['drop'] {
  const hit = empties.find((e) => p.clientX >= e.left && p.clientX <= e.right && p.clientY >= e.top && p.clientY <= e.bottom);
  return hit ? { target: { dock: hit.id, row: 0, index: 0, newRow: true }, mark: { dock: hit.id, row: 0 } } : null;
}

/**
 * One move of a drag that began at `press`. A docked bar that may float lifts once the pointer is more than `TEAR_PX`
 * across from its row, and follows the pointer, keeping where it was held and caught by the corners the way a floating
 * panel is. Within `TEAR_PX` of a dock row it may enter, it drops into the dock again, as a floating bar does; a
 * floating bar keeps following the pointer while it does. `torn` carries the lift from move to move.
 */
export function tearStep(grab: DockGrab, bar: DockBar, press: DockPoint, p: DockPoint, torn: { now: boolean }): DockTearStep {
  const drop = dropAt(grab.boxes, bar, p, bar.float ? TEAR_PX : 0) ?? emptyDropAt(grab.empties ?? [], p);
  const row = grab.row;
  if (bar.float && row && !torn.now) {
    const cross = row.vertical ? p.clientX : p.clientY;
    torn.now = cross < row.start - TEAR_PX || cross > row.end + TEAR_PX;
  }
  if (!bar.float || (row && !torn.now)) return { drop, float: null };
  const ctx = { container: grab.container, item: floatingItem(grab.size), options: { inset: DEFAULT_INSET } };
  const at = dragPlacement(grab.from, p.clientX - press.clientX, p.clientY - press.clientY, ctx);
  const float = { x: at.x, y: at.y, anchor: at.anchor, orientation: grab.from.orientation };
  return { drop, float: drop && row ? null : float };
}

/** Where Alt+Enter docks a floating bar: the end of the last row of the dock it would go to by default. */
export function homeTarget(layout: ToolbarLayout, docks: readonly DockSpec[], bar: DockBar): BarTarget | null {
  const home = homeDock(docks, bar);
  if (!home) return null;
  const rows = layout.docks[home.id] ?? [];
  const last = rows.length - 1;
  return last < 0 ? { dock: home.id, row: 0, index: 0, newRow: true } : { dock: home.id, row: last, index: rows[last]!.length };
}
