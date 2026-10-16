import { Fragment, lazy, type ReactElement, Suspense } from 'react';
import { SchemaPanel } from './surfaces/SchemaSurfaces';
import { useSurfaces } from './surfaces/surfaceState';
import type { SidebarHost } from './surfaces/types';

// The trace log it reads is only populated in DEV, so production leaves the
// panel out of the bundle entirely.
const DispatchTracePanel = import.meta.env.DEV
  ? lazy(() => import('./dev/DispatchTracePanel').then((m) => ({ default: m.DispatchTracePanel })))
  : null;

export type RightSidebarProps = SidebarHost;

/** Every surface asset shown as a panel, in list order, then the dev trace. */
export function RightSidebar(host: RightSidebarProps): ReactElement {
  return (
    <>
      {useSurfaces().map(({ asset, surface, chrome }) => {
        if (surface !== 'panel' || chrome.hidden) return null;
        return asset.render
          ? <Fragment key={asset.id}>{asset.render(host, chrome)}</Fragment>
          : <SchemaPanel key={asset.id} asset={asset} chrome={chrome} />;
      })}
      {DispatchTracePanel && (
        <Suspense fallback={null}>
          <DispatchTracePanel />
        </Suspense>
      )}
    </>
  );
}
