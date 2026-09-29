import { useDepSource } from '@weasel-js/routing/react';
import type { CreateOutlinesAdapter } from './createOutlines';

/** Publish a Create Outlines adapter so the built-in `createOutlines` action
 *  can run. Silently does nothing outside a `<DepRegistryProvider>`. */
export function useCreateOutlinesAdapter(adapter: CreateOutlinesAdapter): void {
  useDepSource('createOutlinesAdapter', () => adapter);
}
