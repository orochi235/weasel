import { Fragment, lazy, type ReactElement, Suspense } from 'react';
import { SchemaPanel } from './surfaces/SchemaSurfaces';
import { useSurfaces } from './surfaces/surfaceState';
import type { SidebarHost } from './surfaces/types';

// A development aid only: production leaves the panel and its package out of the bundle entirely.
const DevtoolsSidebarPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevtoolsSidebarPanel')) : null;

export type RightSidebarProps = SidebarHost;

/** Every surface asset shown as a panel, in list order, then the devtools panel in development. */
export function RightSidebar(host: RightSidebarProps): ReactElement {
  return (
    <>
      {useSurfaces().map(({ asset, surface, chrome, order }) => {
        if (surface !== 'panel' || chrome.hidden) return null;
        return asset.render
          ? <Fragment key={asset.id}>{asset.render(host, chrome)}</Fragment>
          : <SchemaPanel key={asset.id} asset={asset} chrome={chrome} order={order} />;
      })}
      {DevtoolsSidebarPanel && (
        <Suspense fallback={null}>
          <DevtoolsSidebarPanel />
        </Suspense>
      )}
    </>
  );
}
