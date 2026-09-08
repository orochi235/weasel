/**
 * Conditional `<ActionsProvider>` wrapper. Mounts a provider only when no
 * parent registry is in scope — otherwise wraps children in an
 * `<ActionsScope>` so SceneCanvas shares the host's registry without its own
 * opt-outs reaching a sibling canvas.
 */
import type { ReactNode } from 'react';
import {
  ActionsProvider,
  ActionsScope,
  useActionsRegistry,
} from 'interactions/actions/registry';

/** Mount an `<ActionsProvider>` only when none is already in scope, so
 *  nesting canvases share one action registry instead of shadowing it. */
export function ActionsProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = useActionsRegistry();
  if (parent) return <ActionsScope>{children}</ActionsScope>;
  return <ActionsProvider>{children}</ActionsProvider>;
}
