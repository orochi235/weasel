/** The React seam over the dep registry in `./depNode`: its provider and hooks. */
import {
  createContext, useContext, useEffect, useState,
  type ReactNode,
} from 'react';
import type { DepSchema, DepName } from '../../index';
import { createDepRegistry, type DepRegistry } from './depNode';
import { useLatest } from '@weasel-js/react';

export type { DepSchema, DepName, DepRegistry };
export { DepNode, depNodeOf, createDepRegistry } from './depNode';

/** @internal The context `<InputScope>` provides a scope's dep registry through. */
export const DepRegistryContext = createContext<DepRegistry | null>(null);

/** Provides the dep registry for a canvas. `<SceneCanvas>` mounts one; a
 *  consumer registering its own dep sources must be inside it. */
export function DepRegistryProvider({ children }: { children: ReactNode }) {
  const [registry] = useState(createDepRegistry);
  return <DepRegistryContext.Provider value={registry}>{children}</DepRegistryContext.Provider>;
}

/** The dep registry in scope. Throws outside a `<DepRegistryProvider>`. */
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
  const sourceRef = useLatest(source);
  useEffect(() => {
    return registry.register(name, () => sourceRef.current());
  }, [name, registry, sourceRef]);
}
