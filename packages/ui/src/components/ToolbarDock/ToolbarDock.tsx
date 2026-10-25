import { memo, useCallback, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { BarOrientation } from '../Bar';
import { useBarHosts } from './barHosts';
import { DockBarContext } from './dockContext';
import { DOCK_BAR } from './dockDrop';
import { FloatingLayer, floatPlaces } from './floatingLayer';
import { canEnter, isVerticalEdge, resolveLayout, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from './layout';
import { useDockDrag, type DockDrag, type DockDragView } from './useDockDrag';
import s from './ToolbarDock.module.css';

/** Props for {@link ToolbarDock}. */
export interface ToolbarDockProps {
  /** The places toolbars may sit, each on an edge of the workspace. */
  docks: readonly DockSpec[];
  /** The toolbars on offer. */
  bars: readonly DockBar[];
  /** Where each bar sits. Reconciled with `docks` and `bars`, so a stale or partial layout is fine. */
  layout?: ToolbarLayout;
  /**
   * Called once with the layout a move settles on. To accept it, hand back a new `layout` object. The dock keeps
   * drawing the move until its next `layout`, so a host that ignores one goes on seeing it until then.
   */
  onLayoutChange?: (layout: ToolbarLayout) => void;
  /** Makes each bar's lead a handle that moves it: dragged, or with Alt+arrows once focused, and Alt+Enter to float or dock a bar with `float`. */
  movable?: boolean;
  className?: string;
  /** The workspace the docks sit round. */
  children?: ReactNode;
}

const EDGES: readonly DockEdge[] = ['top', 'left', 'right', 'bottom'];

/**
 * Toolbars laid out in docks round a workspace, which fills the middle. The host decides where bars may go: it
 * declares the docks, and each bar lists the docks it may sit in, so a user can only put a bar somewhere the app
 * offers. Each dock holds rows of bars: a top or bottom dock stacks its rows, and a left or right dock sets them side
 * by side as columns with each bar drawn vertical. Only a bar with `vertical` enters a left or right dock; a layout
 * placing any other there sends it to its home dock, a drag over one shows it unavailable, and Alt+arrows skip it. An
 * edge with no bars takes no room.
 *
 * The layout is the user's, so the host keeps it, typically as a user pref; the kit persists nothing. A stored layout
 * is a hint, reconciled with the docks and bars on offer now (see {@link resolveLayout}). A host passes every bar it
 * knows, including one it currently hides: a bar whose `render` gives null, or draws nothing, takes no room and keeps
 * its place in the layout for when it comes back.
 *
 * A bar with `float` may also float over the whole dock, workspace and docks alike: dragged off its dock row, or
 * with Alt+Enter on its handle, and docked again by dropping it on a dock or by Alt+Enter once more. A floating bar
 * keeps the orientation of the dock it left, takes that of the dock it lands in, and is caught by the corners it is
 * dropped near.
 */
export function ToolbarDock({ docks, bars, layout, onLayoutChange, movable = false, className, children }: ToolbarDockProps) {
  const resolved = useMemo(() => resolveLayout(docks, bars, layout), [docks, bars, layout]);
  const byId = useMemo(() => new Map(bars.map((b) => [b.id, b])), [bars]);
  const root = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const move = useDockDrag({ root, layer, docks, bars, layout: resolved, onLayoutChange });
  const { view, layout: shown } = move;
  const dragged = view ? byId.get(view.barId) : undefined;
  const empties = dragged ? docks.filter((d) => canEnter(dragged, d) && !(shown.docks[d.id]?.length ?? 0)) : [];

  const hosts = useBarHosts(bars.map((b) => b.id));
  const drawn = (id: string, orientation: BarOrientation) => drawsIn(byId.get(id), orientation);
  const at = orientations(docks, shown, view);
  const [leasts, setLeasts] = useState<Readonly<Record<string, number>>>({});
  const setLeast = useCallback((id: string, px: number | undefined) => setLeasts((prev) => (prev[id] === px ? prev : withLeast(prev, id, px))), []);

  return (
    <div ref={root} className={[s.root, className].filter(Boolean).join(' ')}>
      {movable && <span aria-live="polite" aria-atomic="true" data-dock-announce="" className={s.status}>{move.announcement}</span>}
      {EDGES.map((edge) => {
        const filled = docks.filter((d) => d.edge === edge && (shown.docks[d.id]?.length ?? 0) > 0);
        if (!filled.length) return null;
        const orientation = isVerticalEdge(edge) ? 'vertical' : 'horizontal';
        return (
          <div key={edge} className={s[edge]} data-dock-edge={edge}>
            {filled.map((dock) => {
              const rows = shown.docks[dock.id]!;
              return (
                <div key={dock.id} className={[s.dock, dock.className].filter(Boolean).join(' ')} data-dock={dock.id} data-dock-unavailable={view?.unavailable.has(dock.id) ? '' : undefined}>
                  {rows.map((row, i) => (
                    <DockRow key={i} index={i} dock={dock.id} view={view}>
                      {row.map((id) => {
                        const lifted = view?.barId === id && view.float !== null;
                        if (!lifted && !drawn(id, orientation)) return null;
                        return (
                          <div key={id} ref={lifted ? undefined : hosts.attach(id)} className={s.slot} style={lifted ? undefined : leastSize(leasts[id])} {...{ [DOCK_BAR]: lifted ? undefined : id }} data-dock-held={lifted ? id : undefined} data-dock-dragging={view?.barId === id ? '' : undefined} data-dock-drop={dropSide(view, id)}>
                            {lifted && <div className={s.hold} style={holdSize(view)} />}
                          </div>
                        );
                      })}
                    </DockRow>
                  ))}
                  {newRowAt(view, dock.id) === rows.length && <div className={s.newRow} data-dock-drop="row" />}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className={s.main}>{children}</div>
      <FloatingLayer layerRef={layer} layout={shown} view={view} empties={empties} drawn={drawn} attach={hosts.attach} />
      {/* Last, so each bar's own effects run once its slot has taken it in. */}
      {[...at].map(([id, orientation]) => {
        const bar = byId.get(id)!;
        return createPortal(<DockedBar bar={bar} orientation={orientation} movable={movable} handlers={move.handlers} setLeast={setLeast} />, hosts.host(id), id);
      })}
    </div>
  );
}

/** Whether `bar` draws anything in `orientation`. */
function drawsIn(bar: DockBar | undefined, orientation: BarOrientation): boolean {
  const out = bar?.render(orientation);
  return out != null && out !== false;
}

/** The orientation each placed bar is drawn in where it is now: its dock's, or the one it floats with. */
function orientations(docks: readonly DockSpec[], layout: ToolbarLayout, view: DockDragView | null): Map<string, BarOrientation> {
  const at = new Map<string, BarOrientation>();
  for (const dock of docks) for (const row of layout.docks[dock.id] ?? []) for (const id of row) at.set(id, isVerticalEdge(dock.edge) ? 'vertical' : 'horizontal');
  for (const [id, place] of floatPlaces(layout, view)) at.set(id, place.orientation);
  return at;
}

/**
 * A bar with its handle, drawn once into the bar's host wherever the bar sits. Memoized, so it redraws only when its
 * bar object, orientation, `movable` or the handlers change, and the dock's re-render on each frame of a drag redraws
 * no bar.
 */
const DockedBar = memo(function DockedBar({ bar, orientation, movable, handlers, setLeast }: { bar: DockBar; orientation: BarOrientation; movable: boolean; handlers: DockDrag['handlers']; setLeast: (id: string, px: number | undefined) => void }) {
  const value = useMemo(
    () => ({ barId: bar.id, label: bar.label, movable, float: bar.float, onLeast: (px: number | undefined) => setLeast(bar.id, px), ...(movable ? handlers(bar.id) : {}) }),
    [bar, movable, handlers, setLeast],
  );
  return <DockBarContext.Provider value={value}>{bar.render(orientation)}</DockBarContext.Provider>;
});

/** `leasts` with bar `id`'s least length set to `px`, or dropped where `px` is undefined. */
function withLeast(leasts: Readonly<Record<string, number>>, id: string, px: number | undefined): Readonly<Record<string, number>> {
  const { [id]: _, ...rest } = leasts;
  return px === undefined ? rest : { ...rest, [id]: px };
}

/** The least length a squeezed row leaves a bar's slot, so it keeps its only item or its menu button. */
const leastSize = (px: number | undefined) => (px === undefined ? undefined : ({ '--dock-least': `${px}px` } as CSSProperties));

/** The room a lifted bar's slot keeps, so its row holds still under the drag. */
const holdSize = (view: DockDragView) => ({ '--dock-hold-w': `${view.size.w}px`, '--dock-hold-h': `${view.size.h}px` }) as CSSProperties;

/** A dock row, after the mark for a new row a drag would make ahead of it. */
function DockRow({ index, dock, view, children }: { index: number; dock: string; view: DockDragView | null; children: ReactNode }) {
  return (
    <>
      {newRowAt(view, dock) === index && <div className={s.newRow} data-dock-drop="row" />}
      <div className={s.row} data-dock-row={index}>
        {children}
      </div>
    </>
  );
}

/** The side of bar `id` a drag would drop beside, if any. */
function dropSide(view: DockDragView | null, id: string): 'before' | 'after' | undefined {
  const drop = view?.drop;
  return drop && 'bar' in drop && drop.bar === id ? drop.side : undefined;
}

/** The row index in `dock` a drag would make a new row at, if any. */
function newRowAt(view: DockDragView | null, dock: string): number | undefined {
  const drop = view?.drop;
  return drop && 'dock' in drop && drop.dock === dock ? drop.row : undefined;
}
