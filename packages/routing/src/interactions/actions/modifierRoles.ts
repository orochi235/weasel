/**
 * Modifier roles: the modifiers an ongoing action reads while it runs, named
 * by what they do rather than which key they are, so a binding or a tuning can
 * move one to another key without forking the action.
 */
import { isApplePlatform, modKey, type ModifierKey, type ModSpec } from '@weasel-js/gestures';
import { setOwn } from '@weasel-js/registry';
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

/**
 * A binding's `mods` that let every key of `roles` be held from the press, or not. The binding
 * matcher forbids a modifier the spec leaves out, so without these a drag started with a role's key
 * down never reaches the action that reads it. `'mod'` lets both Cmd and Ctrl be held.
 */
export function roleMods(roles: ModifierRoles): ModSpec {
  const out: ModSpec = {};
  for (const role of Object.values(roles)) {
    for (const key of role.keys) {
      if (key === 'mod') { out.meta = 'optional'; out.ctrl = 'optional'; } else out[key] = 'optional';
    }
  }
  return out;
}

type PlainKey = 'alt' | 'ctrl' | 'meta' | 'shift';

const admits = (v: boolean | 'optional' | undefined): boolean => v === true || v === 'optional';

/** Whether `mods` let `key` be held from the press. */
function admitted(mods: ModSpec, key: ModifierKey): boolean {
  if (key !== 'mod') return admits(mods[key]);
  return admits(mods.mod) || (admits(mods.meta) && admits(mods.ctrl));
}

/**
 * `spec` letting a moved role's new keys be held from the press, where it let the role's declared keys be: a
 * binding written with {@link roleMods} of an action's roles keeps reaching the action once a tuning or the
 * binding's own `opts.roles` moves one to another key. A key the spec names, required or forbidden, keeps its
 * requirement.
 */
export function withRoleMods<S extends object>(spec: S, roles: ModifierRoles, rebinds?: RoleRebinds): S {
  const declared = declaredRoles(roles);
  const keys = roleKeysOf(roles, rebinds)!;
  const mods: ModSpec = { ...(spec as { mods?: ModSpec }).mods };
  let widened = false;
  const allow = (k: PlainKey): void => {
    if (mods[k] !== undefined) return;
    mods[k] = 'optional';
    widened = true;
  };
  for (const id of Object.keys(declared)) {
    const was = declared[id].keys;
    const now = ownOf(keys, id) ?? was;
    if (now.length === was.length && now.every((k) => was.includes(k))) continue;
    if (!was.every((k) => admitted(mods, k))) continue;
    for (const key of now) {
      if (key === 'mod') { allow('meta'); allow('ctrl'); } else allow(key);
    }
  }
  return widened ? { ...spec, mods } : spec;
}

/** `record`'s own entry for `id`: a role named like an `Object.prototype` member must not read the prototype's. */
const ownOf = <V>(record: Readonly<Record<string, V>> | undefined, id: string): V | undefined =>
  record && Object.hasOwn(record, id) ? record[id] : undefined;

/** Whether any of `keys` is held. */
export function keysHeld(keys: RoleKeys, modifiers: ModifierState, apple: boolean): boolean {
  return keys.some((k) => {
    if (k === 'mod') return modifiers[modKey(apple)];
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
  for (const id of Object.keys(roles)) setOwn(out, id, ownOf(rebinds, id) ?? roles[id].keys);
  return out;
}

/** `keys` with each `'mod'` written as the key it is on this platform. */
export function platformRoleKeys(
  keys: Readonly<Record<string, RoleKeys>>,
  apple: boolean,
): Readonly<Record<string, RoleKeys>> {
  const out: Record<string, RoleKeys> = {};
  for (const id of Object.keys(keys)) setOwn(out, id, keys[id].map((k) => (k === 'mod' ? (apple ? 'meta' : 'ctrl') : k)));
  return out;
}

/** Which roles `modifiers` hold. */
export function resolveRoles(
  keys: Readonly<Record<string, RoleKeys>>,
  modifiers: ModifierState,
  apple: boolean,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of Object.keys(keys)) setOwn(out, id, keysHeld(keys[id], modifiers, apple));
  return out;
}

const DECLARED = new WeakMap<ModifierRoles, ModifierRoles>();

/** `roles` as the action declared them, before a tuning moved any of their keys. */
export function declaredRoles(roles: ModifierRoles): ModifierRoles {
  return DECLARED.get(roles) ?? roles;
}

/** `roles` with `rebinds` written into their keys. */
export function rebindRoles(roles: ModifierRoles, rebinds: RoleRebinds): ModifierRoles {
  const out: Record<string, ModifierRole> = {};
  for (const id of Object.keys(roles)) {
    const keys = ownOf(rebinds, id);
    setOwn(out, id, keys ? { ...roles[id], keys } : roles[id]);
  }
  DECLARED.set(out, declaredRoles(roles));
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
    ownOf(ctx.roles, id) ?? keysHeld(roles[id].keys, ctx.modifiers, isApplePlatform());
}
