/**
 * Conditional `<DepRegistryProvider>` wrapper. Mounts a provider only when
 * no parent registry is in scope — otherwise renders children unwrapped so
 * SceneCanvas defers to the host's existing scope. Mirrors
 * `ActionsProviderIfRoot`.
 *
 * Needed because consumers commonly render the kit `<ActionBar>` as a
 * sibling toolbar above SceneCanvas — that bar's `enabled` predicates read
 * the dep registry, so the registry must live somewhere both can see it.
 */
import type { ReactNode } from 'react';
import {
  DepRegistryProvider,
  useOptionalDepRegistry,
} from 'interactions/actions/depRegistry';

/** Mount a `<DepRegistryProvider>` only when none is already in scope, so a
 *  consumer's dep sources are not shadowed by a nested canvas. */
export function DepRegistryProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = useOptionalDepRegistry();
  if (parent) return <>{children}</>;
  return <DepRegistryProvider>{children}</DepRegistryProvider>;
}
