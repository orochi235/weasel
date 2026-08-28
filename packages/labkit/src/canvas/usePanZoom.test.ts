import { act, renderHook } from '@testing-library/react';
import type { WheelEvent } from 'react';
import { describe, expect, it } from 'vitest';
import type { ViewTransform } from '../instrument/types';
import { type UsePanZoomOptions, usePanZoom } from './usePanZoom';

function wheelEvent(deltaY: number): WheelEvent<HTMLElement> {
  return {
    deltaY,
    clientX: 0,
    clientY: 0,
    preventDefault: () => {},
    currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) },
  } as unknown as WheelEvent<HTMLElement>;
}

/** Renders the hook the way `CanvasStack` drives it: `view` lives in the
 *  test, `onViewChange` writes it, and each wheel call re-renders the hook
 *  with the updated view before returning it. */
function setup(initialView: ViewTransform, options?: Partial<UsePanZoomOptions>) {
  let view = initialView;
  const onViewChange = (v: ViewTransform) => {
    view = v;
  };
  const { result, rerender } = renderHook(
    (props: { view: ViewTransform }) => usePanZoom({ ...options, view: props.view, onViewChange }),
    { initialProps: { view: initialView } },
  );
  const wheel = (deltaY: number): ViewTransform => {
    act(() => result.current.onWheel(wheelEvent(deltaY)));
    rerender({ view });
    return view;
  };
  return { wheel, getView: () => view };
}

describe('usePanZoom', () => {
  it('does not collapse a canvas opening far outside the default range on the first wheel event', () => {
    const { wheel } = setup({ zoom: 1600, pan: { x: 0, y: 0 } });
    const next = wheel(-1); // zoom in slightly
    expect(next.zoom).toBeCloseTo(1600, 0);
  });

  it('keeps the opening zoom reachable after zooming away from it', () => {
    const { wheel } = setup({ zoom: 1600, pan: { x: 0, y: 0 } });
    // Zoom far out.
    for (let i = 0; i < 20; i++) wheel(1000);
    const zoomedOut = wheel(1000);
    expect(zoomedOut.zoom).toBeLessThan(1600);
    // Zoom back in — the opening view must still be reachable.
    for (let i = 0; i < 40; i++) wheel(-1000);
    const zoomedIn = wheel(-1000);
    expect(zoomedIn.zoom).toBeCloseTo(1600, 0);
  });

  it('admits the opening zoom even when an explicit maxZoom is lower than it', () => {
    const { wheel } = setup({ zoom: 1600, pan: { x: 0, y: 0 } }, { maxZoom: 32 });
    const next = wheel(-1);
    expect(next.zoom).toBeCloseTo(1600, 0);
  });

  it('falls back to the plain defaults when the opening zoom is non-finite or zero', () => {
    const nanCase = setup({ zoom: Number.NaN, pan: { x: 0, y: 0 } });
    const nanResult = nanCase.wheel(-100000);
    expect(nanResult.zoom).toBeCloseTo(32, 5);
    expect(Number.isNaN(nanResult.zoom)).toBe(false);

    const zeroCase = setup({ zoom: 0, pan: { x: 0, y: 0 } });
    const zeroResult = zeroCase.wheel(100000);
    expect(zeroResult.zoom).toBeCloseTo(0.1, 5);
  });

  it('still clamps ordinary views to the default range', () => {
    const { wheel } = setup({ zoom: 1, pan: { x: 0, y: 0 } });
    const zoomedIn = wheel(-1_000_000);
    expect(zoomedIn.zoom).toBeCloseTo(32, 5);
    const zoomedOut = wheel(1_000_000);
    expect(zoomedOut.zoom).toBeCloseTo(0.1, 5);
  });
});
