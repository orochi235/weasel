/**
 * A settings form an action carries: what a surface draws in place of a bare
 * trigger for an action whose job is to change settings on the selection.
 */
import type { PrefGroup } from '@weasel-js/prefs';
import type { Action } from './action';
import type { ActionDeps } from './invoker';

/** What a settings form shows for the selection right now. */
export interface ActionSettingsState {
  /** The values, nested as the schema's groups nest. */
  values: Record<string, unknown>;
  /** The leaf paths where the selected items disagree. */
  mixed?: readonly string[];
}

/**
 * The settings form an action carries. A bar or a panel draws the action as a
 * button opening it, a menu as a submenu of its fields, and a palette as a
 * dialog; each change triggers the action with the params it makes.
 */
export interface ActionSettings {
  /** The form. Its `name` titles the popover, submenu or dialog. */
  schema: PrefGroup;
  /** The selection's current values, from the deps `enabled` is given. Under
   *  `enabled`'s contract: pure, fast, and it must not throw. */
  read(deps: ActionDeps): ActionSettingsState;
  /** The params one field's change triggers the action with, or `null` for
   *  none. Default: `{ [path]: value }`. */
  params?(path: string, value: unknown): Record<string, unknown> | null;
}

const EMPTY: ActionSettingsState = { values: {} };

/** `action`'s settings as they stand under `deps`, or `null` for an action
 *  with no settings. A `read` that throws shows nothing rather than breaking
 *  the surface. */
export function readActionSettings(action: Action, deps: ActionDeps | undefined): ActionSettingsState | null {
  const settings = action.settings;
  if (!settings) return null;
  try {
    return settings.read(deps ?? {});
  } catch {
    return EMPTY;
  }
}

/** The params a change of the field at `path` to `value` triggers the action with. */
export function actionSettingsParams(
  settings: ActionSettings,
  path: string,
  value: unknown,
): Record<string, unknown> | null {
  return settings.params ? settings.params(path, value) : { [path]: value };
}
