/**
 * Route-string grammar v2:
 *
 *   route       = phase '.' gesture argSlot? targetSlot? modSlot?
 *   argSlot     = '(' value ')'        // present iff descriptor.arg is set
 *   targetSlot  = '.' target           // present iff descriptor.hasTarget
 *   modSlot     = ':' modifierKey      // optional; absent === 'default'
 *
 * Examples:
 *   initial.click.empty:shift
 *   initial.wheel                       (== initial.wheel(both))
 *   initial.wheel(up)
 *   initial.keyDown(ArrowDown)
 *   initial.contextMenu.empty
 *   initial.multiTouchTap(2)
 */
import { getGestureDescriptor, isKnownGestureName, type GestureName } from './gestures';
import type { ModifierKey } from './modifiers';
import type { RoutePhase } from './reflection/route-resolved';

// ─── v3 grammar types ──────────────────────────────────────────────────────

/** v3 modifier requirement on a single modifier key. Absent from a
 *  `ParsedModifiers` map means "must not be held" (the strict default). */
export type ModRequirement = 'required' | 'optional';

/** Canonical modifier names accepted in the modSlot. */
export type ModName = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

/** Parsed-form modifiers — structured map; absent keys are implicitly
 *  forbidden. Empty object = "no modifiers held". */
export type ParsedModifiers = Partial<Record<ModName, ModRequirement>>;

/** Reserved sigil characters. The parser rejects any of these with a
 *  "reserved for future use" error so introducing them later is
 *  non-breaking. `*` is NOT in this set — it's the universal wildcard. */
export const RESERVED_SIGILS: ReadonlySet<string> = new Set(['!', '@', '#', '$', '%', '^', '&']);

/** Active (parseable) sigils today: `+` required, `?` optional. */
export const ACTIVE_SIGILS: ReadonlySet<string> = new Set(['+', '?']);

export const VALID_MOD_NAMES: readonly ModName[] = ['mod', 'shift', 'alt', 'ctrl', 'meta'];
const MOD_NAME_SET = new Set<string>(VALID_MOD_NAMES);
export { MOD_NAME_SET };

/** @deprecated v2 shape — replaced by `ParsedRoute` (v3) in tasks A2/A3. */
export interface ParsedRouteV2 {
  phase: RoutePhase;
  gesture: GestureName;
  /** Resolved arg value. For a gesture with a default arg, the default is
   *  filled in when the route omits the slot. Undefined iff descriptor.arg
   *  is undefined OR a free-form arg slot was omitted. */
  arg: string | undefined;
  target: string | undefined;
  modifiers: ModifierKey;
}

/** v3 parsed-route shape. */
export interface ParsedRoute {
  /** One or more phases. `['*']` is the wildcard sentinel for "any
   *  phase". Empty array is invalid. */
  phases: readonly RoutePhase[] | readonly ['*'];
  gesture: GestureName;
  /** Resolved arg. For arg-bearing gestures, the descriptor's default
   *  fills in when the slot is omitted (e.g. `wheel` → `arg: '*'`).
   *  Undefined for gestures whose descriptor has no `arg`. */
  arg: string | undefined;
  /** For hasTarget gestures: target string with `'*'` as the wildcard
   *  sentinel. Defaults to `'*'` when the slot is omitted. Undefined for
   *  hasTarget=false gestures. */
  target: string | undefined;
  /** Structured modifier requirements; empty map = "no modifiers held". */
  modifiers: ParsedModifiers;
}

const ARG_RE = /^([^(]+)\(([^)]*)\)$/;

export function parseRoute(route: string): ParsedRouteV2 {
  const [body, modsPart] = route.split(':') as [string, string | undefined];
  const segments = body.split('.');
  if (segments.length < 2) throw new Error(`invalid route (need phase.gesture): ${route}`);
  const [phase, gestureRaw, ...rest] = segments as [RoutePhase, string, ...string[]];

  const argMatch = ARG_RE.exec(gestureRaw);
  const gestureName = argMatch ? argMatch[1]! : gestureRaw;
  const rawArg = argMatch ? argMatch[2] : undefined;

  if (!isKnownGestureName(gestureName)) {
    throw new Error(`invalid route (unknown gesture "${gestureName}"): ${route}`);
  }
  const desc = getGestureDescriptor(gestureName);

  if (rawArg !== undefined && !desc.arg) {
    throw new Error(`invalid route (${gestureName} does not take an argument): ${route}`);
  }
  let arg: string | undefined;
  if (desc.arg) {
    arg = rawArg ?? desc.arg.default;
    if (arg !== undefined && desc.arg.values !== 'free' && !desc.arg.values.includes(arg)) {
      throw new Error(`invalid route (${arg} not in [${desc.arg.values.join(', ')}]): ${route}`);
    }
  }

  const target = rest.length > 0 ? rest.join('.') : undefined;
  if (target !== undefined && !desc.hasTarget) {
    throw new Error(`invalid route (${gestureName} does not have a target): ${route}`);
  }

  const modifiers = (modsPart ?? 'default') as ModifierKey;
  return { phase, gesture: gestureName, arg, target, modifiers };
}

export function formatRoute(r: ParsedRouteV2): string {
  const desc = getGestureDescriptor(r.gesture);
  let out = `${r.phase}.${r.gesture}`;
  if (desc.arg && r.arg !== undefined && r.arg !== desc.arg.default) {
    out += `(${r.arg})`;
  }
  if (r.target !== undefined) out += `.${r.target}`;
  if (r.modifiers !== 'default') out += `:${r.modifiers}`;
  return out;
}
