/**
 * Conditional `<ActionsProvider>` wrapper: mounts one only when no registry is
 * in scope, and otherwise renders its children against the one there. Used by
 * a non-isolated `<WeaselProvider>`.
 */
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';

/** Mount an `<ActionsProvider>` only when none is already in scope. */
export function ActionsProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = useActionsRegistry();
  if (parent) return <>{children}</>;
  return <ActionsProvider>{children}</ActionsProvider>;
}
