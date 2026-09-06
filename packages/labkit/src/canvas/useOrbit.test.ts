import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, expect, it } from 'vitest';
import {
  clampPitch,
  type OrbitView,
  orbitAfterDrag,
  orbitAfterWheel,
  PITCH_LIMIT,
  useOrbit,
  wrapYaw,
} from './useOrbit';

const view = { yaw: 0, pitch: 0, distance: 5, target: { x: 0, y: 0, z: 0 } };

describe('clampPitch', () => {
  it('stops just short of the poles, where azimuth becomes undefined', () => {
    expect(clampPitch(Math.PI)).toBeCloseTo(PITCH_LIMIT);
    expect(clampPitch(-Math.PI)).toBeCloseTo(-PITCH_LIMIT);
    expect(PITCH_LIMIT).toBeLessThan(Math.PI / 2);
  });

  it('leaves an in-range pitch alone', () => {
    expect(clampPitch(0.3)).toBe(0.3);
  });
});

describe('wrapYaw', () => {
  it('wraps into (-PI, PI] so a value cannot drift without bound', () => {
    expect(wrapYaw(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(-3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapYaw(0.5)).toBeCloseTo(0.5);
  });

  it('keeps a full turn equivalent to no turn', () => {
    expect(wrapYaw(2 * Math.PI)).toBeCloseTo(0);
  });
});

describe('orbitAfterDrag', () => {
  it('turns horizontal movement into yaw and vertical into pitch', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.yaw).not.toBe(view.yaw);
    expect(next.pitch).not.toBe(view.pitch);
  });

  it('is absolute against the drag start, so re-applying does not compound', () => {
    const once = orbitAfterDrag(view, 100, 50);
    const twice = orbitAfterDrag(view, 100, 50);
    expect(twice).toEqual(once);
  });

  it('clamps pitch rather than tumbling past the pole', () => {
    const next = orbitAfterDrag(view, 0, 100_000);
    expect(Math.abs(next.pitch)).toBeLessThanOrEqual(PITCH_LIMIT);
  });

  it('leaves distance and target untouched', () => {
    const next = orbitAfterDrag(view, 100, 50);
    expect(next.distance).toBe(view.distance);
    expect(next.target).toEqual(view.target);
  });
});

describe('orbitAfterWheel', () => {
  it('moves the camera in and out', () => {
    expect(orbitAfterWheel(view, 100, 0.5, 50).distance).toBeGreaterThan(view.distance);
    expect(orbitAfterWheel(view, -100, 0.5, 50).distance).toBeLessThan(view.distance);
  });

  it('is multiplicative, so a step feels the same at every distance', () => {
    const near = orbitAfterWheel({ ...view, distance: 2 }, 100, 0.5, 50);
    const far = orbitAfterWheel({ ...view, distance: 20 }, 100, 0.5, 50);
    expect(far.distance / 20).toBeCloseTo(near.distance / 2);
  });

  it('honours its bounds', () => {
    expect(orbitAfterWheel(view, 100_000, 0.5, 50).distance).toBe(50);
    expect(orbitAfterWheel(view, -100_000, 0.5, 50).distance).toBe(0.5);
  });
});

/** The fields `useOrbit` reads off a React pointerdown, plus the element the
 *  session hangs its document listeners off. */
function press(
  el: HTMLElement,
  x: number,
  y: number,
  init: { pointerId?: number; button?: number; buttons?: number } = {},
): ReactPointerEvent<HTMLElement> {
  return {
    pointerId: init.pointerId ?? 1,
    button: init.button ?? 0,
    buttons: init.buttons ?? 1,
    clientX: x,
    clientY: y,
    currentTarget: el,
  } as unknown as ReactPointerEvent<HTMLElement>;
}

function dispatchOn(target: EventTarget, type: string, init: PointerEventInit) {
  act(() => {
    target.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, ...init }));
  });
}

function dragSetup() {
  let current: OrbitView = view;
  const onViewChange = (v: OrbitView) => {
    current = v;
  };
  const { result, unmount } = renderHook(() => useOrbit({ view, onViewChange }));
  const el = document.createElement('div');
  document.body.appendChild(el);
  return { result, unmount, el, getView: () => current };
}

describe('useOrbit dragging', () => {
  it('turns from a move the element never sees', () => {
    const { result, el, getView } = dragSetup();
    act(() => result.current.onPointerDown(press(el, 100, 100)));
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 200, clientY: 150 });
    expect(getView()).toEqual(orbitAfterDrag(view, 100, 50));
  });

  it('ends the drag on a release dispatched off the element', () => {
    const { result, el, getView } = dragSetup();
    act(() => result.current.onPointerDown(press(el, 100, 100)));
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 200, clientY: 150 });
    dispatchOn(document, 'pointerup', { clientX: 200, clientY: 150 });
    expect(result.current.isDragging()).toBe(false);
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 400, clientY: 400 });
    expect(getView()).toEqual(orbitAfterDrag(view, 100, 50));
  });

  // The other half of the rule — a detached origin does cancel — is owned by
  // pointerSession.test.ts, which exercises it without React in the way.
  it('keeps turning when capture is lost and the element is still in the document', () => {
    const { result, el, getView } = dragSetup();
    act(() => result.current.onPointerDown(press(el, 100, 100)));
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 200, clientY: 150 });
    // Chrome releases capture a beat before it delivers pointerup, so ending
    // here throws away a release that has already been dispatched.
    dispatchOn(el, 'lostpointercapture', {});
    expect(result.current.isDragging()).toBe(true);
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 400, clientY: 400 });
    expect(getView()).toEqual(orbitAfterDrag(view, 300, 300));
  });

  it('reads a move with nothing held as the release that never arrived', () => {
    const { result, el, getView } = dragSetup();
    act(() => result.current.onPointerDown(press(el, 100, 100, { buttons: 1 })));
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 200, clientY: 150 });
    expect(getView()).toEqual(orbitAfterDrag(view, 100, 50));
    dispatchOn(document, 'pointermove', { buttons: 0, clientX: 400, clientY: 400 });
    expect(getView()).toEqual(orbitAfterDrag(view, 100, 50));
    expect(result.current.isDragging()).toBe(false);
  });

  it('drops its listeners when the hook unmounts mid-drag', () => {
    const { result, el, unmount, getView } = dragSetup();
    act(() => result.current.onPointerDown(press(el, 100, 100)));
    unmount();
    dispatchOn(document, 'pointermove', { buttons: 1, clientX: 400, clientY: 400 });
    expect(getView()).toEqual(view);
  });
});
