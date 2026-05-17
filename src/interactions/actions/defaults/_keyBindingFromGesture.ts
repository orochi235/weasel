/**
 * Phase 14e Task 5 helper.
 *
 * Derives a legacy `KeyBinding`-shaped value from a descriptor's
 * `gestureBinding`. The 10 default actions previously carried both fields
 * statically; Task 5 removed `defaultBinding` from the descriptor and uses
 * this helper inside each factory to keep the factory-output shape backward-
 * compatible (the ~40 existing tests assert on `factory(deps).defaultBinding`).
 *
 * Task 6 will rewrite those tests and delete this helper.
 *
 * @internal — not part of the public surface.
 */

import type { GestureSpec } from '../../gestures/spec';
import type { BoundGesture } from '../registry';
import type { KeyBinding } from '../useKeybinding';

/** Convert a `KeySpec`-shaped GestureSpec to the legacy `KeyBinding`. */
function specToKeyBinding(spec: GestureSpec): KeyBinding | null {
  if (spec.kind !== 'key') return null;
  const out: KeyBinding = { key: spec.key };
  const mods = spec.mods;
  if (mods?.mod) out.mod = true;
  if (mods?.alt) out.alt = true;
  if (mods?.shift !== undefined) out.shift = mods.shift;
  return out;
}

/**
 * Pick the "canonical" KeyBinding for a descriptor whose `gestureBinding`
 * may be an array of parametric bindings. `pickIndex` selects which entry
 * (default 0). Returns null when no key-spec is present.
 */
export function deriveDefaultBinding(
  gestureBinding: GestureSpec | BoundGesture | readonly BoundGesture[] | undefined,
  pickIndex = 0,
): KeyBinding | undefined {
  if (!gestureBinding) return undefined;
  if (Array.isArray(gestureBinding)) {
    const entry = gestureBinding[pickIndex] ?? gestureBinding[0];
    if (!entry) return undefined;
    const spec = 'spec' in entry ? entry.spec : entry;
    return specToKeyBinding(spec) ?? undefined;
  }
  const g = gestureBinding as GestureSpec | BoundGesture;
  const spec = 'spec' in g ? g.spec : g;
  return specToKeyBinding(spec) ?? undefined;
}
