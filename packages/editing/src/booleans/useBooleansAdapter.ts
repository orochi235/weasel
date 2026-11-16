import { useDepSource } from '@weasel-js/routing/react';
import type { BooleansAdapter } from './booleans';

/** Publish a Boolean-ops adapter so the built-in Pathfinder actions can run.
 *  Silently does nothing outside a `<DepRegistryProvider>`. */
export function useBooleansAdapter(adapter: BooleansAdapter): void {
  useDepSource('booleansAdapter', () => adapter);
}
