import type { ReactNode } from 'react';
import { LabAsideRegion, LabSidebarRegion } from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import { Split } from '../primitives/Split';
import { usePersistedState } from '../state/usePersistedState';
import { useSurfaceOptional } from '../surface/useSurfaceTile';

/** The strip holding the sidebar beside the tool rail and workspace. Its own component
 *  because the width is a persisted value, and `LabRuntime` renders the
 *  persistence provider it reads from. */
export function LabPanes({
  contributions,
  children,
}: {
  contributions: readonly LabContribution[];
  children: ReactNode;
}) {
  const surface = useSurfaceOptional();
  const [sidebarWidth, setSidebarWidth] = usePersistedState<number | undefined>(
    'lk-lab-sidebar-width',
    undefined,
    { scope: 'lab' },
  );
  const [asideWidth, setAsideWidth] = usePersistedState<number | undefined>(
    'lk-lab-aside-width',
    undefined,
    { scope: 'lab' },
  );
  const main = contributions.some((c) => c.region === 'aside') ? (
    <Split
      className="lk-lab__panes"
      side="end"
      sidebarClassName="lk-lab__aside"
      contentClassName="lk-lab__main"
      label="Lab aside"
      defaultWidth={320}
      width={asideWidth}
      onWidthChange={(w) => {
        setAsideWidth(w);
        surface?.invalidateRects();
      }}
      sidebar={<LabAsideRegion contributions={contributions} />}
    >
      {children}
    </Split>
  ) : (
    children
  );
  if (!contributions.some((c) => c.region === 'sidebar')) return main;
  return (
    <Split
      className="lk-lab__panes"
      sidebarClassName="lk-lab__sidebar"
      contentClassName="lk-lab__main"
      label="Lab sidebar"
      defaultWidth={260}
      width={sidebarWidth}
      onWidthChange={(w) => {
        setSidebarWidth(w);
        surface?.invalidateRects();
      }}
      sidebar={<LabSidebarRegion contributions={contributions} />}
    >
      {main}
    </Split>
  );
}
