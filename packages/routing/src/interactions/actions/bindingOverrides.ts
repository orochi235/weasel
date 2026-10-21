/**
 * Binding overrides: a host's replacements for bindings it did not write,
 * keyed by binding id. An override replaces or removes one binding, on an
 * action or on a contribution alike; adding a key beside the defaults is
 * `tune`'s job.
 */
import { bindingSpec, type BindingOverrideInput, type GestureSpec } from '@weasel-js/gestures';
import type { GestureBinding } from './binding';

/** Overrides by binding id: a route string or spec to bind instead, or `null` to unbind. */
export type BindingOverrides = Readonly<Record<string, BindingOverrideInput>>;

/** Overrides read into specs, one per binding id. */
export type ResolvedBindingOverrides = ReadonlyMap<string, GestureSpec | null>;

export const NO_OVERRIDES: ResolvedBindingOverrides = new Map();

/** A binding's id: its declared `opts.id`, else its owner (the entry, or the
 *  action for an action's own binding) and its position there. */
export function bindingId(b: GestureBinding, ownerId: string | null, index: number): string {
  return b.opts?.id ?? `${ownerId ?? b.actionId}#${index}`;
}

/** Merge override maps into one, a later map winning per id. */
export function resolveBindingOverrides(maps: readonly BindingOverrides[]): ResolvedBindingOverrides {
  if (maps.length === 0) return NO_OVERRIDES;
  const out = new Map<string, GestureSpec | null>();
  for (const map of maps) {
    for (const [id, input] of Object.entries(map)) out.set(id, bindingSpec(input));
  }
  return out;
}

/** `b` under its override: the same binding, one with another spec, or `null` when unbound. */
export function overridden(
  b: GestureBinding,
  id: string,
  overrides: ResolvedBindingOverrides,
): GestureBinding | null {
  if (!overrides.has(id)) return b;
  const spec = overrides.get(id)!;
  return spec === null ? null : { ...b, spec };
}
