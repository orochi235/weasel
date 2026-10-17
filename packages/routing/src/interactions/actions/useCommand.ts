import { useMemo, type ReactNode } from 'react';
import type { GestureSpec } from '@weasel-js/gestures';
import { useLatest, useStableByContent } from '@weasel-js/react';
import type { Action, ActionDisabledReason } from './action';
import { useAction } from './ActionsProvider';

/** What a command offers besides its id, label and callback. */
export interface CommandOptions {
  /** True when the command can run, else why not. Read each time it is asked. */
  enabled?: () => true | ActionDisabledReason;
  /** Whether it reads as held down. Read each time it is asked. */
  active?: () => boolean;
  /** The gestures that run it. */
  keys?: GestureSpec | readonly GestureSpec[];
  /** Shown beside the label. A function is read each time it is shown. */
  icon?: ReactNode | (() => ReactNode);
  /** Words a palette finds it by and a tagged bar or menu gathers it under. */
  tags?: readonly string[];
}

/**
 * Register `run` as an action under `id` on the nearest `<ActionsProvider>`
 * for the calling component's lifetime, so a menu, toolbar, palette or key
 * can run it. Callbacks and option functions may be new on every render: the
 * latest are read when used, and the action is replaced only when `id`,
 * `label`, `keys` or `tags` change by value.
 */
export function useCommand(id: string, label: string, run: () => void, options?: CommandOptions): void {
  const latest = useLatest({ run, options });
  const keys = useStableByContent(options?.keys, sameValue);
  const tags = useStableByContent(options?.tags, sameValue);
  const hasEnabled = options?.enabled !== undefined;
  const hasActive = options?.active !== undefined;
  const hasIcon = options?.icon !== undefined;
  const action = useMemo<Action>(() => {
    const read = () => latest.current.options;
    const a: Action = {
      id,
      label,
      invoker: { timing: 'immediate', run: () => latest.current.run() },
    };
    if (keys !== undefined) a.defaultBinding = Array.isArray(keys) ? [...keys] : (keys as GestureSpec);
    if (tags !== undefined) a.tags = tags;
    if (hasEnabled) a.enabled = () => read()?.enabled?.() ?? true;
    if (hasActive) a.active = () => read()?.active?.() ?? false;
    if (hasIcon) {
      a.icon = () => {
        const icon = read()?.icon;
        return typeof icon === 'function' ? icon() : icon;
      };
    }
    return a;
  }, [id, label, keys, tags, hasEnabled, hasActive, hasIcon, latest]);
  useAction(action);
}

/** Structural equality over plain objects and arrays; functions by reference. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.hasOwn(b, k)
    && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
