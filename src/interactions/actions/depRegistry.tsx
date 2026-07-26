/**
 * Dep registry for registry unification.
 *
 * Holds named "live source" thunks. Actions declare `requires: ['selection']`;
 * the dispatcher calls `registry.get('selection')` at invocation time to
 * build a typed Deps bag.
 *
 * `DepSchema` — the map of dep name → value type — is the single source of
 * truth for what `requires`/`register`/`get` accept. Its concrete fields live
 * in `./depSchema` (co-located with the dep value types). It is declared there
 * as a plain `export interface` rather than via a cross-module
 * `declare module './depRegistry'` augmentation: that augmentation does NOT
 * merge once rollup-plugin-dts flattens both files into one `.d.ts` chunk,
 * which silently emptied `DepSchema` for consumers. Consumers still extend it
 * via `declare module '@weasel-js/core'` augmentation.
 */
import {
  createContext, useContext, useEffect, useMemo, useRef,
  type ReactNode,
} from 'react';
import type { DepSchema, DepName } from './depSchema';

export type { DepSchema, DepName };

export interface DepRegistry {
  register<K extends DepName>(name: K, source: () => DepSchema[K]): () => void;
  get<K extends DepName>(name: K): DepSchema[K] | undefined;
}

const DepRegistryContext = createContext<DepRegistry | null>(null);

export function DepRegistryProvider({ children }: { children: ReactNode }) {
  const sourcesRef = useRef(new Map<DepName, () => unknown>() as Map<string, () => unknown>);

  const registry = useMemo<DepRegistry>(() => ({
    register: <K extends DepName>(name: K, source: () => DepSchema[K]) => {
      sourcesRef.current.set(name as string, source as () => unknown);
      return () => { sourcesRef.current.delete(name as string); };
    },
    get: <K extends DepName>(name: K) =>
      sourcesRef.current.get(name as string)?.() as DepSchema[K] | undefined,
  }), []);

  return <DepRegistryContext.Provider value={registry}>{children}</DepRegistryContext.Provider>;
}

export function useDepRegistry(): DepRegistry {
  const r = useContext(DepRegistryContext);
  if (r === null) {
    throw new Error('useDepRegistry: no DepRegistryProvider in scope. Wrap your tree with <DepRegistryProvider> (typically inside <SceneCanvas>).');
  }
  return r;
}

/**
 * Like `useDepRegistry`, but returns `null` when no `<DepRegistryProvider>` is
 * in scope instead of throwing. Used by `useStandardActions` to preserve its
 * silent-no-op contract when neither provider is present.
 */
export function useOptionalDepRegistry(): DepRegistry | null {
  return useContext(DepRegistryContext);
}

/** Register a live source for `name` for the lifetime of the calling
 *  component. The `source` thunk is called at dispatch time and should
 *  return the latest value. */
export function useDepSource<K extends DepName>(name: K, source: () => DepSchema[K]) {
  const registry = useDepRegistry();
  const sourceRef = useRef(source);
  sourceRef.current = source;
  useEffect(() => {
    return registry.register(name, () => sourceRef.current());
  }, [name, registry]);
}
