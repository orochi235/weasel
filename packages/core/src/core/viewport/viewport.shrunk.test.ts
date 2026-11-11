/** Counterexamples the viewport property tests shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { sameView } from './view';
import { zoomAt, axisZoomFactor } from './zoomAt';
import { deriveParallaxView, planeMap } from './parallax';
import { wheelPan } from './wheelHandler';

describe('viewport, shrunk counterexamples', () => {
  it('a zoom on x leaves y exactly where it was', () => {
    const view = { x: 0, y: -0.0018, scale: { x: 0.31622776601683794, y: 0.3162379601599075 } };
    const next = zoomAt(view, { x: 0, y: -0.0001 }, axisZoomFactor(0.01, 'x'));
    expect(next.y).toBe(-0.0018);
    expect(next.scale.y).toBe(view.scale.y);
  });

  it('a plane at pan 1 and zoom 1 is the camera exactly, and its map is the identity', () => {
    const outer = { x: 0, y: 0, scale: { x: 1, y: 0.17426223430892449 } };
    expect(sameView(deriveParallaxView(outer, { pan: 1, zoom: 1 }), outer)).toBe(true);
    expect(planeMap(outer, { pan: 1, zoom: 1 })).toEqual({ scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } });
    expect(deriveParallaxView({ x: 7.3, y: -2.1, scale: { x: 0.01, y: 0.01 } }, { pan: 0, anchor: { x: 0.1, y: 0.2 } }))
      .toEqual({ x: 0.1, y: 0.2, scale: { x: 0.01, y: 0.01 } });
  });

  it('a zoom by a negative or NaN factor keeps the axis, by 0 keeps a flipped axis flipped, and a wild anchor stays finite', () => {
    expect(zoomAt({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { x: 0, y: 0 }, -0.5).scale).toEqual({ x: 1, y: 1 });
    expect(zoomAt({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { x: 0, y: 0 }, NaN).scale).toEqual({ x: 1, y: 1 });
    expect(zoomAt({ x: 0, y: 0, scale: { x: 1, y: -1 } }, { x: 0, y: 0 }, { x: 0.001, y: 0 }).scale).toEqual({ x: 0.1, y: -0.1 });
    expect(zoomAt({ x: 3, y: 0, scale: { x: 1, y: 1 } }, { x: NaN, y: 0 }, 2)).toEqual({ x: 3, y: 0, scale: { x: 2, y: 2 } });
  });

  it('a wheel pan by a delta that is not finite, or past the double range, leaves that axis where it was', () => {
    const v = { x: 0, y: 2, scale: { x: 0.1, y: 0.1 } };
    expect(wheelPan(v, { deltaX: Infinity, deltaY: 1 })).toEqual({ x: 0, y: 12, scale: v.scale });
    expect(wheelPan({ ...v, x: Number.MAX_VALUE }, { deltaX: Number.MAX_VALUE, deltaY: NaN }).x).toBe(Number.MAX_VALUE);
  });
});
