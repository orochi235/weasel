import { useLayoutEffect, useReducer, useSyncExternalStore } from 'react';
import {
  buildDepsFromRequires,
  evaluateActive,
  evaluateEnabled,
  useOptionalDepRegistry,
  type ActionItem,
} from '@weasel-js/core';

/** What chrome shows of one action: whether it can run, and whether it is on. */
export interface ActionState {
  enabled: boolean;
  active: boolean | undefined;
}

const noSubscribe = (): (() => void) => () => {};

/**
 * Each item's {@link ActionState}, kept current. An action's deps are thunks
 * nothing can watch, so this re-reads when the dep registry says a source
 * changed, and once more after a commit whose render read a dep that the same
 * commit then published.
 */
export function useActionStates(items: readonly ActionItem[]): ActionState[] {
  const depReg = useOptionalDepRegistry();
  const read = (item: ActionItem): ActionState => {
    const deps = depReg ? buildDepsFromRequires(item.action, depReg) : undefined;
    return { enabled: evaluateEnabled(item.action, deps).enabled, active: evaluateActive(item.action, deps) };
  };
  // The snapshot is what the chrome shows, so a notice that changes none of
  // it costs no render.
  const states = (): string => items.map((item) => {
    const now = read(item);
    return `${now.enabled}/${now.active}`;
  }).join();
  useSyncExternalStore(depReg?.subscribe ?? noSubscribe, states, states);

  const shown = items.map(read);
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    const stale = items.some((item, i) => {
      const now = read(item);
      return now.enabled !== shown[i]!.enabled || now.active !== shown[i]!.active;
    });
    if (stale) recheck();
  });
  return shown;
}
