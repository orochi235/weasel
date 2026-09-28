import { describe, it, expect } from 'vitest';
import { routeGestureForSpecKind, specKindForRouteGesture } from './specKinds';
import { GESTURE_DESCRIPTORS } from './gestures';

describe('spec kind ↔ route gesture', () => {
  it('names the route gesture for each spec kind', () => {
    expect(routeGestureForSpecKind('key')).toBe('keyDown');
    expect(routeGestureForSpecKind('key-held')).toBe('keyHeld');
    expect(routeGestureForSpecKind('doubleClick')).toBe('dblTap');
    expect(routeGestureForSpecKind('drop')).toBe('drop');
    expect(routeGestureForSpecKind('multiTouch')).toBeUndefined();
  });

  it('names the spec kind for each route gesture, and none for keyUp', () => {
    expect(specKindForRouteGesture('keyDown')).toBe('key');
    expect(specKindForRouteGesture('keyHeld')).toBe('key-held');
    expect(specKindForRouteGesture('dblTap')).toBe('doubleClick');
    expect(specKindForRouteGesture('keyUp')).toBeUndefined();
  });

  it('round-trips every route gesture that has a spec kind', () => {
    for (const { name } of GESTURE_DESCRIPTORS) {
      const kind = specKindForRouteGesture(name);
      if (kind !== undefined) expect(routeGestureForSpecKind(kind)).toBe(name);
    }
  });
});
