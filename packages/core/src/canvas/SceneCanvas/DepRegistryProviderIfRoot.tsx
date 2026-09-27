/**
 * Conditional `<DepRegistryProvider>` wrapper: mounts one only when no registry
 * is in scope, and otherwise renders its children against the one there. Used
 * by a non-isolated `<WeaselProvider>`. Mirrors `ActionsProviderIfRoot`.
 */
import type { ReactNode } from 'react';
import { DepRegistryProvider, useOptionalDepRegistry } from '@weasel-js/routing/react';

/** Mount a `<DepRegistryProvider>` only when none is already in scope, so a
 *  consumer's dep sources are not shadowed by a nested canvas. */
export function DepRegistryProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = useOptionalDepRegistry();
  if (parent) return <>{children}</>;
  return <DepRegistryProvider>{children}</DepRegistryProvider>;
}
