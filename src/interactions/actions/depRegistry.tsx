/**
 * Dep registry for registry unification.
 *
 * Holds named "live source" thunks. Actions declare `requires: ['selection']`;
 * the dispatcher calls `registry.get('selection')` at invocation time to
 * build a typed Deps bag.
 *
 * `DepSchema` is intentionally an empty interface so consumers (apps,
 * features) augment it via declaration merging. The kit ships extensions
 * for `selection`, `view`, etc. as feature modules land.
 */
import {
  createContext, useContext, useEffect, useMemo, useRef,
  type ReactNode,
} from 'react';

// Empty by design — see module JSDoc. Extend via declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DepSchema {}
export type DepName = keyof DepSchema;

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
