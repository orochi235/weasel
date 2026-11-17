import { useLayoutEffect, useReducer, useSyncExternalStore } from 'react';
import { buildDepsFromRequires, eligibleNow, evaluateActive, evaluateEnabled, type ActionItem } from '@weasel-js/routing';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';

/** What chrome shows of one action: whether it can run, and whether it is on. */
export interface ActionState {
  disabled: boolean;
  active: boolean | undefined;
  /** Why it cannot run, when it says — an `ActionDisabledReason`. */
  disabledReason?: string;
}

const noSubscribe = (): (() => void) => () => {};

/**
 * The live {@link ActionState} of each item, in order: what a button, menu row
 * or toolbar built on its own needs to gray out an action and say why. Items
 * come from `actionItems` (`@weasel-js/core`), and each is asked with its own
 * params, so every variant of a parametric action has a state of its own.
 *
 * Deps resolve through the nearest dep registry, when there is one. An
 * action's deps are thunks nothing can watch, so this re-reads when the dep
 * registry says a source changed, and once more after a commit whose render
 * read a dep that the same commit then published. A change that touches no
 * item's state costs no render.
 */
export function useActionStates(items: readonly ActionItem[]): ActionState[] {
  const depReg = useOptionalDepRegistry();
  const read = (item: ActionItem): ActionState => {
    const deps = depReg ? buildDepsFromRequires(item.action, depReg) : undefined;
    const active = evaluateActive(item.action, deps, item.params);
    if (!eligibleNow(item.action, depReg?.get('ruleCtx'))) return { disabled: true, active };
    const { enabled, reason } = evaluateEnabled(item.action, deps, undefined, item.params);
    return { disabled: !enabled, active, ...(reason !== undefined ? { disabledReason: reason } : {}) };
  };
  // The snapshot is what the chrome shows, so a notice that changes none of
  // it costs no render.
  const states = (): string => items.map((item) => {
    const now = read(item);
    return `${now.disabled}/${now.active}/${now.disabledReason ?? ''}`;
  }).join();
  useSyncExternalStore(depReg?.subscribe ?? noSubscribe, states, states);

  const shown = items.map(read);
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    const stale = items.some((item, i) => {
      const now = read(item);
      return now.disabled !== shown[i]!.disabled || now.active !== shown[i]!.active;
    });
    if (stale) recheck();
  });
  return shown;
}
