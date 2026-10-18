import { useState, type ReactNode } from 'react';
import { createSnapSourceRegistry, SnapSourceRegistryContext } from 'features/snap/registry';
import { IconRegistryProviderIfRoot } from '../../iconRegistry';
import { ViewInputsProvider, type SurfaceViewInputs } from '../viewInputs';
import { PointerProviderIfRoot } from './PointerProviderIfRoot';

/** The kit providers a canvas mounts around its surface: view inputs and the
 *  snap source registry, then the icon registry and pointer context where none
 *  is already in scope. */
export function CanvasKitProviders({ viewInputs, children }: { viewInputs: SurfaceViewInputs; children: ReactNode }) {
  const [snapRegistry] = useState(createSnapSourceRegistry);
  return (
    <ViewInputsProvider value={viewInputs}>
      <SnapSourceRegistryContext.Provider value={snapRegistry}>
        <IconRegistryProviderIfRoot>
          <PointerProviderIfRoot>{children}</PointerProviderIfRoot>
        </IconRegistryProviderIfRoot>
      </SnapSourceRegistryContext.Provider>
    </ViewInputsProvider>
  );
}
