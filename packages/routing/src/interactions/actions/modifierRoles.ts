/**
 * Modifier roles: the modifiers an ongoing action reads while it runs, named
 * by what they do rather than which key they are, so a binding or a tuning can
 * move one to another key without forking the action.
 */
import { isApplePlatform, type ModifierKey } from '@weasel-js/gestures';
import type { ModifierState } from '../../vocabulary';

/** The keys that hold a role: any one of them held holds it. `'mod'` is Cmd
 *  on a Mac and Ctrl elsewhere. An empty list never holds it. */
export type RoleKeys = readonly ModifierKey[];

/** One modifier an action reads mid-gesture. */
export interface ModifierRole {
  label: string;
  /** The keys that hold it unless a tuning or a binding says otherwise. */
  keys: RoleKeys;
}

/** An action's roles by id, e.g. `'handle.holdAngle'`. */
export type ModifierRoles = Readonly<Record<string, ModifierRole>>;

/** Keys a tuning or a binding gives some of an action's roles. */
export type RoleRebinds = Readonly<Record<string, RoleKeys>>;

/** Whether any of `keys` is held. */
export function keysHeld(keys: RoleKeys, modifiers: ModifierState, isMac: boolean): boolean {
  return keys.some((k) => {
    if (k === 'mod') return isMac ? modifiers.meta : modifiers.ctrl;
    return modifiers[k];
  });
}

/** The keys each of `roles` answers to with `rebinds` laid over them, or
 *  undefined when the action declares none. A rebind naming a role the action
 *  does not declare is dropped. */
export function roleKeysOf(
  roles: ModifierRoles | undefined,
  rebinds?: RoleRebinds,
): Readonly<Record<string, RoleKeys>> | undefined {
  if (!roles) return undefined;
  const out: Record<string, RoleKeys> = {};
  for (const id of Object.keys(roles)) out[id] = rebinds?.[id] ?? roles[id].keys;
  return out;
}

/** `keys` with each `'mod'` written as the key it is on this platform. */
export function platformRoleKeys(
  keys: Readonly<Record<string, RoleKeys>>,
  isMac: boolean,
): Readonly<Record<string, RoleKeys>> {
  const out: Record<string, RoleKeys> = {};
  for (const id of Object.keys(keys)) out[id] = keys[id].map((k) => (k === 'mod' ? (isMac ? 'meta' : 'ctrl') : k));
  return out;
}

/** Which roles `modifiers` hold. */
export function resolveRoles(
  keys: Readonly<Record<string, RoleKeys>>,
  modifiers: ModifierState,
  isMac: boolean,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of Object.keys(keys)) out[id] = keysHeld(keys[id], modifiers, isMac);
  return out;
}

/** `roles` with `rebinds` written into their keys. */
export function rebindRoles(roles: ModifierRoles, rebinds: RoleRebinds): ModifierRoles {
  const out: Record<string, ModifierRole> = {};
  for (const id of Object.keys(roles)) {
    out[id] = rebinds[id] ? { ...roles[id], keys: rebinds[id] } : roles[id];
  }
  return out;
}

/**
 * A reader for an action's own roles. It answers from `ctx.roles`, which the
 * dispatcher resolves on every event, and falls back to the role's default
 * keys where nothing resolved them: an invoker called directly, or a context
 * a cancel-all built with no event.
 */
export function roleReader<R extends ModifierRoles>(roles: R) {
  return (ctx: { roles?: Readonly<Record<string, boolean>>; modifiers: ModifierState }, id: keyof R & string): boolean =>
    ctx.roles?.[id] ?? keysHeld(roles[id].keys, ctx.modifiers, isApplePlatform());
}
