/**
 * Conditional `<ActionsProvider>` wrapper. Mounts a provider only when no
 * parent registry is in scope — otherwise renders children unwrapped so
 * SceneCanvas defers to the host's existing scope.
 */
import type { ReactNode } from 'react';
import {
  ActionsProvider,
  useActionsRegistry,
} from 'interactions/actions/registry';

/** Mount an `<ActionsProvider>` only when none is already in scope, so
 *  nesting canvases share one action registry instead of shadowing it. */
export function ActionsProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = useActionsRegistry();
  if (parent) return <>{children}</>;
  return <ActionsProvider>{children}</ActionsProvider>;
}
