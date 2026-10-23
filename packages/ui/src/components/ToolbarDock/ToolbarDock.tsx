import { useMemo, useRef, type ReactNode } from 'react';
import { DockBarContext } from './dockContext';
import { DOCK_BAR } from './dockDrop';
import { resolveLayout, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from './layout';
import { useDockDrag, type DockDragView } from './useDockDrag';
import s from './ToolbarDock.module.css';

/** Props for {@link ToolbarDock}. */
export interface ToolbarDockProps {
  /** The places toolbars may sit, each on an edge of the workspace. */
  docks: readonly DockSpec[];
  /** The toolbars on offer. */
  bars: readonly DockBar[];
  /** Where each bar sits. Reconciled with `docks` and `bars`, so a stale or partial layout is fine. */
  layout?: ToolbarLayout;
  /** Called with the layout a move settles on. */
  onLayoutChange?: (layout: ToolbarLayout) => void;
  /** Makes each bar's lead a handle that moves it: dragged, or with Alt+arrows once focused. */
  movable?: boolean;
  className?: string;
  /** The workspace the docks sit round. */
  children?: ReactNode;
}

const EDGES: readonly DockEdge[] = ['top', 'left', 'right', 'bottom'];

/**
 * Toolbars laid out in docks round a workspace, which fills the middle. Each dock holds rows of bars: a top or
 * bottom dock stacks its rows, and a left or right dock sets them side by side with each bar drawn vertical. An
 * edge with no bars takes no room.
 */
export function ToolbarDock({ docks, bars, layout, onLayoutChange, movable = false, className, children }: ToolbarDockProps) {
  const resolved = useMemo(() => resolveLayout(docks, bars, layout), [docks, bars, layout]);
  const byId = useMemo(() => new Map(bars.map((b) => [b.id, b])), [bars]);
  const root = useRef<HTMLDivElement>(null);
  const move = useDockDrag({ root, docks, bars, layout: resolved, onLayoutChange });
  const view = move.view;

  return (
    <div ref={root} className={[s.root, className].filter(Boolean).join(' ')}>
      {movable && <span role="status" className={s.status}>{move.announcement}</span>}
      {EDGES.map((edge) => {
        const filled = docks.filter((d) => d.edge === edge && (resolved.docks[d.id]?.length ?? 0) > 0);
        if (!filled.length) return null;
        const orientation = edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
        return (
          <div key={edge} className={s[edge]} data-dock-edge={edge}>
            {filled.map((dock) => {
              const rows = resolved.docks[dock.id]!;
              return (
                <div key={dock.id} className={s.dock} data-dock={dock.id} data-dock-unavailable={view?.unavailable.has(dock.id) ? '' : undefined}>
                  {rows.map((row, i) => (
                    <DockRow key={i} index={i} dock={dock.id} view={view}>
                      {row.map((id) => {
                        const bar = byId.get(id);
                        if (!bar) return null;
                        const value = { barId: id, label: bar.label, movable, ...(movable ? move.handlers(id) : {}) };
                        return (
                          <div key={id} className={s.slot} {...{ [DOCK_BAR]: id }} data-dock-dragging={view?.barId === id ? '' : undefined} data-dock-drop={dropSide(view, id)}>
                            <DockBarContext.Provider value={value}>{bar.render(orientation)}</DockBarContext.Provider>
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
    </div>
  );
}

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
