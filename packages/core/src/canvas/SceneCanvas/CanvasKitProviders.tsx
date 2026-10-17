import type { ReactNode } from 'react';
import { IconRegistryProviderIfRoot } from '../../iconRegistry';
import { ViewInputsProvider, type SurfaceViewInputs } from '../viewInputs';
import { PointerProviderIfRoot } from './PointerProviderIfRoot';

/** The kit providers a canvas mounts around its surface: view inputs, then the
 *  icon registry and pointer context where none is already in scope. */
export function CanvasKitProviders({ viewInputs, children }: { viewInputs: SurfaceViewInputs; children: ReactNode }) {
  return (
    <ViewInputsProvider value={viewInputs}>
      <IconRegistryProviderIfRoot>
        <PointerProviderIfRoot>{children}</PointerProviderIfRoot>
      </IconRegistryProviderIfRoot>
    </ViewInputsProvider>
  );
}
