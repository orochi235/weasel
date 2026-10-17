import { useMemo } from 'react';
import type { GestureSpec } from '@weasel-js/gestures';
import type { IconRef } from '@weasel-js/icons';
import { useLatest, useStableByContent } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import type { Action, ActionDisabledReason, ActionVariant } from './action';
import { useAction } from './ActionsProvider';

/** What a command offers besides its id, label and callback. */
export interface CommandOptions {
  /** True when the command can run, else why not. Read each time it is asked. */
  enabled?: () => true | ActionDisabledReason;
  /** Whether it reads as held down. Read each time it is asked. */
  active?: () => boolean;
  /** The gestures that run it. */
  keys?: GestureSpec | readonly GestureSpec[];
  /** Shown beside the label. */
  icon?: IconRef;
  /** Words a palette finds it by and a tagged bar or menu gathers it under. */
  tags?: readonly string[];
  /** One entry each in a bar, menu or palette; `run` receives the chosen one's params. */
  variants?: readonly ActionVariant[];
}

/**
 * Register `run` as an action under `id` on the nearest `<ActionsProvider>`
 * for the calling component's lifetime, so a menu, toolbar, palette or key
 * can run it. Callbacks and option functions may be new on every render: the
 * latest are read when used, and the action is replaced only when `id`,
 * `label`, `icon`, `keys`, `tags` or `variants` change by value.
 */
export function useCommand(
  id: string,
  label: string,
  run: (params?: Readonly<Record<string, unknown>>) => void,
  options?: CommandOptions,
): void {
  const latest = useLatest({ run, options });
  const keys = useStableByContent(options?.keys, deepEqual);
  const tags = useStableByContent(options?.tags, deepEqual);
  const variants = useStableByContent(options?.variants, deepEqual);
  const hasEnabled = options?.enabled !== undefined;
  const hasActive = options?.active !== undefined;
  const icon = options?.icon;
  const action = useMemo<Action>(() => {
    const read = () => latest.current.options;
    const a: Action = {
      id,
      label,
      invoker: { timing: 'immediate', run: (_deps, params) => latest.current.run(params) },
    };
    if (keys !== undefined) a.defaultBinding = Array.isArray(keys) ? [...keys] : (keys as GestureSpec);
    if (tags !== undefined) a.tags = tags;
    if (variants !== undefined) a.variants = variants;
    if (hasEnabled) a.enabled = () => read()?.enabled?.() ?? true;
    if (hasActive) a.active = () => read()?.active?.() ?? false;
    if (icon !== undefined) a.icon = icon;
    return a;
  }, [id, label, icon, keys, tags, variants, hasEnabled, hasActive, latest]);
  useAction(action);
}
