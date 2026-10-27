import { createContext, useContext, useEffect } from 'react';
import type { SnapSource } from './types';

/** The sources contributed to one canvas by {@link useSnapSource}, in mount order. */
export interface SnapSourceRegistry {
  list(): readonly SnapSource[];
  add(source: SnapSource): () => void;
}

export function createSnapSourceRegistry(): SnapSourceRegistry {
  let sources: readonly SnapSource[] = [];
  return {
    list: () => sources,
    add(source) {
      sources = [...sources, source];
      return () => { sources = sources.filter((s) => s !== source); };
    },
  };
}

export const SnapSourceRegistryContext = createContext<SnapSourceRegistry | null>(null);

/** Adds `source` to the enclosing `<SceneCanvas>`'s snapping while mounted.
 *  Pass a stable object: a new one each render re-registers it. */
export function useSnapSource(source: SnapSource): void {
  const registry = useContext(SnapSourceRegistryContext);
  if (!registry) throw new Error('[useSnapSource] call it under a <SceneCanvas>');
  useEffect(() => registry.add(source), [registry, source]);
}
