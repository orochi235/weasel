import type { GestureSpec } from '../ui/spec';
import type { GestureName } from './gestures';

type SpecKind = GestureSpec['kind'];

/** `GestureSpec.kind` → route-grammar gesture name. `multiTouch` has no
 *  route gesture (only its tap synthesis does), and `keyUp` has no spec kind,
 *  so neither direction is total. */
const SPEC_KIND_TO_GESTURE: Record<SpecKind, GestureName | undefined> = {
  key: 'keyDown',
  'key-held': 'keyHeld',
  wheel: 'wheel',
  pinch: 'pinch',
  click: 'click',
  doubleClick: 'dblTap',
  contextMenu: 'contextMenu',
  longPress: 'longPress',
  drag: 'drag',
  pointerDown: 'pointerDown',
  multiTouch: undefined,
  multiTouchTap: 'multiTouchTap',
  drop: 'drop',
  paste: 'paste',
};

const GESTURE_TO_SPEC_KIND = new Map<GestureName, SpecKind>(
  (Object.entries(SPEC_KIND_TO_GESTURE) as [SpecKind, GestureName | undefined][])
    .filter((e): e is [SpecKind, GestureName] => e[1] !== undefined)
    .map(([kind, gesture]) => [gesture, kind]),
);

/** The route-grammar gesture a `GestureSpec.kind` routes as, or `undefined`
 *  for a kind the grammar has no name for. */
export function routeGestureForSpecKind(kind: SpecKind): GestureName | undefined {
  return SPEC_KIND_TO_GESTURE[kind];
}

/** The `GestureSpec.kind` a route-grammar gesture is written as, or
 *  `undefined` for a gesture no spec can express. */
export function specKindForRouteGesture(gesture: GestureName): SpecKind | undefined {
  return GESTURE_TO_SPEC_KIND.get(gesture);
}
