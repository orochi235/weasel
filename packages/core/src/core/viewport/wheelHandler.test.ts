import { describe, it, expect } from 'vitest';
import {
  computeWheelAction,
  wheelPan,
  wheelZoom,
  wheelZoomFactor,
  type WheelInput,
} from './wheelHandler';
import type { View } from './view';
import { DEFAULT_MIN_ZOOM, DEFAULT_MAX_ZOOM } from './zoomBounds';
import { viewportZoomAction } from 'interactions/actions/defaults/viewportZoom';
import { viewportWheelPanAction } from 'interactions/actions/defaults/viewportWheelPan';
import type { ViewApi } from 'interactions/actions/depSchema';

const base: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const at = (x: number, y: number): Pick<WheelInput, 'x' | 'y'> => ({ x, y });

/** World point currently painted at the given canvas-local pixel. */
function worldUnder(view: View, x: number, y: number) {
  return { x: x / view.scale.x + view.x, y: y / view.scale.y + view.y };
}

function makeView(initial: View = base): ViewApi & { value: View } {
  const api = {
    value: initial,
    get() { return api.value; },
    set(next: View) { api.value = next; },
  };
  return api as ViewApi & { value: View };
}

// ---------------------------------------------------------------------------
// Modifier convention
// ---------------------------------------------------------------------------

describe('computeWheelAction — modifier convention', () => {
  it('pans on a bare wheel and leaves scale alone', () => {
    const next = computeWheelAction(base, { deltaX: 10, deltaY: 40, ...at(100, 100) });
    expect(next.scale).toEqual({ x: 1, y: 1 });
    expect(next).toMatchObject({ x: 10, y: 40 });
  });

  it('routes deltaY into x on shift+wheel', () => {
    const next = computeWheelAction(base, {
      deltaX: 0, deltaY: 40, shiftKey: true, ...at(100, 100),
    });
    expect(next).toMatchObject({ x: 40, y: 0 });
  });

  it('zooms on meta+wheel', () => {
    const next = computeWheelAction(base, {
      deltaX: 0, deltaY: -100, metaKey: true, ...at(100, 100),
    });
    expect(next.scale.x).toBeCloseTo(1.1, 10);
  });

  it('zooms on ctrl+wheel (trackpad pinch)', () => {
    const next = computeWheelAction(base, {
      deltaX: 0, deltaY: -100, ctrlKey: true, ...at(100, 100),
    });
    expect(next.scale.x).toBeCloseTo(1.1, 10);
  });
});

// ---------------------------------------------------------------------------
// Coordinate convention
// ---------------------------------------------------------------------------

describe('computeWheelAction — coordinate convention', () => {
  it('divides the pan delta by scale, so one wheel pixel is one screen pixel', () => {
    const zoomed: View = { x: 0, y: 0, scale: { x: 2, y: 4 } };
    const next = computeWheelAction(zoomed, { deltaX: 10, deltaY: 40, ...at(0, 0) });
    expect(next).toMatchObject({ x: 5, y: 10 });
  });

  it('holds the world point under the anchor fixed while zooming', () => {
    const start: View = { x: 3, y: -7, scale: { x: 2, y: 2 } };
    const before = worldUnder(start, 250, 130);
    const next = computeWheelAction(start, {
      deltaX: 0, deltaY: -100, metaKey: true, ...at(250, 130),
    });
    const after = worldUnder(next, 250, 130);
    expect(after.x).toBeCloseTo(before.x, 10);
    expect(after.y).toBeCloseTo(before.y, 10);
  });

  it('returns to the same scale when a step is undone', () => {
    const inThenOut = computeWheelAction(
      computeWheelAction(base, { deltaX: 0, deltaY: -73, metaKey: true, ...at(40, 40) }),
      { deltaX: 0, deltaY: 73, metaKey: true, ...at(40, 40) },
    );
    expect(inThenOut.scale.x).toBeCloseTo(1, 10);
  });

  it('clamps to the kit-wide zoom bounds', () => {
    const wayIn = computeWheelAction(
      { x: 0, y: 0, scale: { x: 7.9, y: 7.9 } },
      { deltaX: 0, deltaY: -10000, metaKey: true, ...at(0, 0) },
    );
    expect(wayIn.scale.x).toBe(DEFAULT_MAX_ZOOM);
    const wayOut = computeWheelAction(
      { x: 0, y: 0, scale: { x: 0.11, y: 0.11 } },
      { deltaX: 0, deltaY: 10000, metaKey: true, ...at(0, 0) },
    );
    expect(wayOut.scale.x).toBe(DEFAULT_MIN_ZOOM);
  });

  it('honors an explicit clamp', () => {
    const next = computeWheelAction(
      base,
      { deltaX: 0, deltaY: -10000, metaKey: true, ...at(0, 0) },
      { max: 3 },
    );
    expect(next.scale.x).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

describe('wheelZoomFactor / wheelZoom / wheelPan', () => {
  it('steps 1.1x per 100px of scroll-up', () => {
    expect(wheelZoomFactor(-100)).toBeCloseTo(1.1, 10);
    expect(wheelZoomFactor(100)).toBeCloseTo(1 / 1.1, 10);
    expect(wheelZoomFactor(0)).toBe(1);
  });

  it('locks wheelPan to one axis', () => {
    expect(wheelPan(base, { deltaX: 10, deltaY: 40 }, { axis: 'x' })).toMatchObject({ x: 10, y: 0 });
    expect(wheelPan(base, { deltaX: 10, deltaY: 40 }, { axis: 'y' })).toMatchObject({ x: 0, y: 40 });
  });

  it('prefers a real deltaX over the swapped deltaY', () => {
    expect(wheelPan(base, { deltaX: 6, deltaY: 40 }, { swapAxis: true })).toMatchObject({ x: 6, y: 0 });
  });

  it('wheelZoom anchors where it is told', () => {
    expect(wheelZoom(base, { x: 200, y: 0 }, -100)).toEqual(
      computeWheelAction(base, { deltaX: 0, deltaY: -100, metaKey: true, ...at(200, 0) }),
    );
  });
});

// ---------------------------------------------------------------------------
// The actions and the reducer are one implementation
// ---------------------------------------------------------------------------

describe('the wheel actions agree with the reducer', () => {
  it('viewport.zoom matches computeWheelAction on a modified wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 2 } });
    const invoker = viewportZoomAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { kind: 'wheel', deltaY: -120, clientX: 250, clientY: 130 });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 2 } },
        { deltaX: 0, deltaY: -120, metaKey: true, ...at(250, 130) },
      ),
    );
  });

  it('viewport.wheelPan matches computeWheelAction on a bare wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 4 } });
    const invoker = viewportWheelPanAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { deltaX: 12, deltaY: -30 });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 4 } },
        { deltaX: 12, deltaY: -30, ...at(0, 0) },
      ),
    );
  });

  it('viewport.wheelPan matches computeWheelAction on shift+wheel', () => {
    const view = makeView({ x: 3, y: -7, scale: { x: 2, y: 4 } });
    const invoker = viewportWheelPanAction.invoker!;
    if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
    invoker.run({ view }, { deltaX: 0, deltaY: -30, swapAxis: true });
    expect(view.value).toEqual(
      computeWheelAction(
        { x: 3, y: -7, scale: { x: 2, y: 4 } },
        { deltaX: 0, deltaY: -30, shiftKey: true, ...at(0, 0) },
      ),
    );
  });
});
