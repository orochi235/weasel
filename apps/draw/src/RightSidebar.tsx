import { lazy, type ReactElement, Suspense } from 'react';
import { SchemaPanel } from './surfaces/SchemaSurfaces';
import { useSurfaces } from './surfaces/surfaceState';

// A development aid only: production leaves the panel and its package out of the bundle entirely.
const DevtoolsSidebarPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevtoolsSidebarPanel')) : null;

/** Every surface asset shown as a panel, in list order, then the devtools panel in development. The panels read the
 *  editor's state from the `SurfaceHostContext` above. */
export function RightSidebar(): ReactElement {
  return (
    <>
      {useSurfaces().map(({ asset, surface, chrome, order }) =>
        surface !== 'panel' || chrome.hidden ? null : <SchemaPanel key={asset.id} asset={asset} chrome={chrome} order={order} />,
      )}
      {DevtoolsSidebarPanel && (
        <Suspense fallback={null}>
          <DevtoolsSidebarPanel />
        </Suspense>
      )}
    </>
  );
}
