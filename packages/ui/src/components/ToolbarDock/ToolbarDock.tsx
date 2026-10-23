import { useMemo, type ReactNode } from 'react';
import { DockBarContext } from './dockContext';
import { resolveLayout, type DockBar, type DockEdge, type DockSpec, type ToolbarLayout } from './layout';
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
  /** Makes each bar's lead a handle that moves it. */
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
export function ToolbarDock({ docks, bars, layout, movable = false, className, children }: ToolbarDockProps) {
  const resolved = useMemo(() => resolveLayout(docks, bars, layout), [docks, bars, layout]);
  const byId = useMemo(() => new Map(bars.map((b) => [b.id, b])), [bars]);

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
      {EDGES.map((edge) => {
        const filled = docks.filter((d) => d.edge === edge && (resolved.docks[d.id]?.length ?? 0) > 0);
        if (!filled.length) return null;
        const orientation = edge === 'left' || edge === 'right' ? 'vertical' : 'horizontal';
        return (
          <div key={edge} className={s[edge]} data-dock-edge={edge}>
            {filled.map((dock) => (
              <div key={dock.id} className={s.dock} data-dock={dock.id}>
                {resolved.docks[dock.id]!.map((row, i) => (
                  <div key={i} className={s.row} data-dock-row={i}>
                    {row.map((id) => {
                      const bar = byId.get(id);
                      return (
                        bar && (
                          <DockBarContext.Provider key={id} value={{ barId: id, label: bar.label, movable }}>
                            {bar.render(orientation)}
                          </DockBarContext.Provider>
                        )
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      <div className={s.main}>{children}</div>
    </div>
  );
}
