/**
 * Declarative gesture taxonomy. Single source of truth for:
 *   - which gestures hit-test (have a `.target` slot in the route string)
 *   - which gestures carry an argument and what values are legal
 *   - the default arg value (used when none is specified in a route)
 *
 * Reflection, matcher, and inspector UI all read this table. Adding a new
 * gesture name in one place updates every consumer.
 */

export type GestureName =
  | 'click'
  | 'pointerDown'
  | 'dblTap'
  | 'drag'
  | 'wheel'
  | 'keyDown'
  | 'keyUp'
  | 'contextMenu'
  | 'multiTouchTap';

export interface GestureArgSpec {
  /** Display name for the arg in inspector chips (`direction`, `key`, `fingers`). */
  name: string;
  /** Acceptable values. `'free'` means any string (e.g. key names). */
  values: readonly string[] | 'free';
  /** Default value when a route omits the arg slot. Must be in `values`
   *  unless `values === 'free'`. Optional: no default means routes that
   *  omit the arg slot match every value (only legal for `'free'` args). */
  default?: string;
}

export interface GestureDescriptor {
  name: GestureName;
  /** Does the route's `.target` slot apply? Targetless gestures (`wheel`,
   *  `keyDown/Up`, `multiTouchTap`) elide it entirely in the v2 grammar. */
  hasTarget: boolean;
  /** Optional argument spec. Encoded as `gesture(value)` in the route string. */
  arg?: GestureArgSpec;
}

export const GESTURE_DESCRIPTORS: readonly GestureDescriptor[] = [
  { name: 'click',         hasTarget: true  },
  { name: 'pointerDown',   hasTarget: true  },
  { name: 'dblTap',        hasTarget: true  },
  { name: 'drag',          hasTarget: true  },
  { name: 'wheel',         hasTarget: false, arg: { name: 'direction', values: ['up', 'down', '*'], default: '*' } },
  { name: 'keyDown',       hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'keyUp',         hasTarget: false, arg: { name: 'key',       values: 'free' } },
  { name: 'contextMenu',   hasTarget: true  },
  { name: 'multiTouchTap', hasTarget: false, arg: { name: 'fingers',   values: ['2', '3', '4'] } },
];

const BY_NAME = new Map<string, GestureDescriptor>(
  GESTURE_DESCRIPTORS.map((d) => [d.name, d]),
);

export function getGestureDescriptor(name: GestureName): GestureDescriptor {
  const d = BY_NAME.get(name);
  if (!d) throw new Error(`unknown gesture: ${name}`);
  return d;
}

export function isKnownGestureName(name: string): name is GestureName {
  return BY_NAME.has(name);
}
