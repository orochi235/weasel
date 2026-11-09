import { useMemo } from 'react';
import type { IconSpec } from '@weasel-js/icons';
import type { MenuGrade } from '@weasel-js/menu';
import { useLatest, useStableByContent } from '@weasel-js/react';
import { deepEqual } from '@weasel-js/registry';
import type { Action, ActionUnavailable, ActionVariant } from './action';
import type { ActionSettings, ActionSettingsState } from './actionSettings';
import type { BoundGesture } from './binding';
import { useAction } from './ActionsProvider';

type Params = Readonly<Record<string, unknown>>;

/** What a command offers besides its id, label and callback. */
export interface CommandOptions {
  /** True when the command can run, else why not: an `ActionDisabledReason`, or a sentence shown as it is.
   *  Read each time it is asked, with the params the run would get: a variant's, for one variant. */
  enabled?: (params?: Params) => true | ActionUnavailable;
  /** Whether it reads as held down, for the variant `params` names. Read each time it is asked. */
  active?: (params?: Params) => boolean;
  /** Show what running it with `params` would do, and change nothing; returns what takes that down. Read each
   *  time it is asked. See `Action.preview`. */
  preview?: (params?: Params) => (() => void) | void;
  /** A form of the settings it changes: `read` gives the values now, and each change runs it with the params
   *  the change makes. `read` and `params` are read each time they are asked. See `Action.settings`. */
  settings?: CommandSettings;
  /** Display text for its shortcut, in place of the one written out from `keys`. */
  shortcut?: string;
  /** What it does, in a sentence: a tooltip or a hint. */
  description?: string;
  /** How serious running it is; `'danger'` for one that destroys something. */
  grade?: MenuGrade;
  /** The gestures that run it. The `{ spec, opts: { params } }` form gives one variant its own key. */
  keys?: BoundGesture | readonly BoundGesture[];
  /** Shown beside the label. */
  icon?: IconSpec;
  /** The registry group a bar drawing one group gathers it under. */
  group?: string;
  /** Words a palette finds it by and a tagged bar or menu gathers it under. */
  tags?: readonly string[];
  /** One entry each in a bar, menu or palette; `run` receives the chosen one's params. */
  variants?: readonly ActionVariant[];
}

/** A command's settings form: an `ActionSettings` whose `read` takes no deps, since a command has none. */
export interface CommandSettings extends Omit<ActionSettings, 'read'> {
  read(): ActionSettingsState;
}

/**
 * Register `run` as an action under `id` on the nearest `<ActionsProvider>`
 * for the calling component's lifetime, so a menu, toolbar, palette or key
 * can run it. Callbacks and option functions may be new on every render: the
 * latest are read when used, and the action is replaced only when `id`,
 * `label`, `icon`, `group`, `keys`, `tags`, `variants`, `shortcut`,
 * `description`, `grade` or the settings' schema change by value, or one of
 * `enabled`, `active`, `preview` and `settings` comes or goes.
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
  const schema = useStableByContent(options?.settings?.schema, deepEqual);
  const icon = useStableByContent(options?.icon, deepEqual);
  const hasEnabled = options?.enabled !== undefined;
  const hasActive = options?.active !== undefined;
  const hasPreview = options?.preview !== undefined;
  const hasSettingsParams = options?.settings?.params !== undefined;
  const { group, shortcut, description, grade } = options ?? {};
  const action = useMemo<Action>(() => {
    const read = () => latest.current.options;
    const a: Action = {
      id,
      label,
      invoker: { timing: 'immediate', run: (_deps, params) => latest.current.run(params) },
    };
    if (keys !== undefined) a.defaultBinding = bindingOf(keys);
    if (tags !== undefined) a.tags = tags;
    if (variants !== undefined) a.variants = variants;
    if (hasEnabled) a.enabled = (_deps, _at, _carried, params) => read()?.enabled?.(params) ?? true;
    if (hasActive) a.active = (_deps, params) => read()?.active?.(params) ?? false;
    if (hasPreview) a.preview = (_deps, params) => read()?.preview?.(params);
    if (schema !== undefined) {
      a.settings = { schema, read: () => read()?.settings?.read() ?? { values: {} } };
      if (hasSettingsParams) a.settings.params = (path, value) => read()?.settings?.params?.(path, value) ?? null;
    }
    if (icon !== undefined) a.icon = icon;
    if (group !== undefined) a.group = group;
    if (shortcut !== undefined) a.shortcut = shortcut;
    if (description !== undefined) a.description = description;
    if (grade !== undefined) a.grade = grade;
    return a;
  }, [id, label, icon, group, shortcut, description, grade, keys, tags, variants, schema,
    hasEnabled, hasActive, hasPreview, hasSettingsParams, latest]);
  useAction(action);
}

function bindingOf(keys: BoundGesture | readonly BoundGesture[]): Action['defaultBinding'] {
  if (isList(keys)) return [...keys];
  return 'spec' in keys ? [keys] : keys;
}

const isList = (keys: BoundGesture | readonly BoundGesture[]): keys is readonly BoundGesture[] => Array.isArray(keys);
