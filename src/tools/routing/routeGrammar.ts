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

export interface ParsedRoute {
  phase: RoutePhase;
  gesture: GestureName;
  /** Resolved arg value. For a gesture with a default arg, the default is
   *  filled in when the route omits the slot. Undefined iff descriptor.arg
   *  is undefined OR a free-form arg slot was omitted. */
  arg: string | undefined;
  target: string | undefined;
  modifiers: ModifierKey;
}

const ARG_RE = /^([^(]+)\(([^)]*)\)$/;

export function parseRoute(route: string): ParsedRoute {
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

export function formatRoute(r: ParsedRoute): string {
  const desc = getGestureDescriptor(r.gesture);
  let out = `${r.phase}.${r.gesture}`;
  if (desc.arg && r.arg !== undefined && r.arg !== desc.arg.default) {
    out += `(${r.arg})`;
  }
  if (r.target !== undefined) out += `.${r.target}`;
  if (r.modifiers !== 'default') out += `:${r.modifiers}`;
  return out;
}
