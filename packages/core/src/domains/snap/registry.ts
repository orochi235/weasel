import { createContext, useContext, useEffect } from 'react';
import type { SnapSource } from './types';

/** The sources contributed to one canvas by {@link useSnapSource}, in mount order. */
export interface SnapSourceRegistry {
  list(): readonly SnapSource[];
  add(source: SnapSource): () => void;
}

export function createSnapSourceRegistry(): SnapSourceRegistry {
  // One record per add, so a source two components add is two entries and each release takes out its own.
  let adds: readonly { source: SnapSource }[] = [];
  let sources: readonly SnapSource[] = [];
  const set = (next: readonly { source: SnapSource }[]) => {
    adds = next;
    sources = next.map((a) => a.source);
  };
  return {
    list: () => sources,
    add(source) {
      const mine = { source };
      set([...adds, mine]);
      return () => { if (adds.includes(mine)) set(adds.filter((a) => a !== mine)); };
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
