import { describe, it, expect } from 'vitest';
import { createViewportLayer, viewportsAt } from './viewportLayer';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';

const OUTER: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 600, height: 400 };

/** Source that draws nothing — reprojection is pure geometry. */
const EMPTY_SOURCE: RenderLayer<unknown> = {
  id: 'src', label: 'src', space: 'world', draw: () => [],
};

/** The demo's PiP: 240x160 at bottom-left, 1.6x, showing world from (250, 200). */
function pip() {
  return createViewportLayer<unknown>({
    id: 'pip',
    label: 'PiP',
    source: [EMPTY_SOURCE],
    view: { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } },
    bounds: (_outer, dims) => ({ x: 8, y: dims.height - 168, w: 240, h: 160 }),
  });
}

describe('viewport reprojection', () => {
  it('maps the rect top-left to the inner view origin', () => {
    expect(pip().reproject(OUTER, DIMS, { x: 8, y: 232 })).toEqual({ x: 250, y: 200 });
  });

  it('divides by the inner scale', () => {
    // 160 screen px right of the rect's left edge, at 1.6x → 100 world units.
    expect(pip().reproject(OUTER, DIMS, { x: 168, y: 232 })).toEqual({ x: 350, y: 200 });
  });

  it('round-trips against the mapping the layer draws with', () => {
    const layer = pip();
    const inner = { x: 250, y: 200, scale: 1.6 };
    const b = { x: 8, y: 232 };
    for (const world of [{ x: 300, y: 250 }, { x: 260.5, y: 205.25 }, { x: 399, y: 299 }]) {
      // Forward: the same composition createViewportLayer paints with —
      // source applies the inner view, the group translates by the bounds.
      const screen = {
        x: (world.x - inner.x) * inner.scale + b.x,
        y: (world.y - inner.y) * inner.scale + b.y,
      };
      const back = layer.reproject(OUTER, DIMS, screen)!;
      expect(back.x).toBeCloseTo(world.x);
      expect(back.y).toBeCloseTo(world.y);
    }
  });

  it('returns null outside the rect', () => {
    const layer = pip();
    expect(layer.reproject(OUTER, DIMS, { x: 7, y: 232 })).toBeNull();   // left
    expect(layer.reproject(OUTER, DIMS, { x: 8, y: 231 })).toBeNull();   // above
    expect(layer.reproject(OUTER, DIMS, { x: 248, y: 300 })).toBeNull(); // right edge is exclusive
    expect(layer.reproject(OUTER, DIMS, { x: 100, y: 392 })).toBeNull(); // bottom edge is exclusive
  });

  it('tracks bounds that move with the canvas size', () => {
    const layer = pip();
    // Same rect-relative point, taller canvas → the rect follows the bottom edge.
    const tall = { width: 600, height: 500 };
    expect(layer.reproject(OUTER, tall, { x: 8, y: 332 })).toEqual({ x: 250, y: 200 });
    // The rect moved down with the bottom edge, so the old origin is now above it.
    expect(layer.reproject(OUTER, tall, { x: 8, y: 232 })).toBeNull();
  });
});

describe('viewportsAt', () => {
  const a = createViewportLayer<unknown>({
    id: 'a', label: 'a', source: [EMPTY_SOURCE],
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    bounds: () => ({ x: 0, y: 0, w: 100, h: 100 }),
  });
  const b = createViewportLayer<unknown>({
    id: 'b', label: 'b', source: [EMPTY_SOURCE],
    view: { x: 500, y: 500, scale: { x: 1, y: 1 } },
    bounds: () => ({ x: 50, y: 50, w: 100, h: 100 }),
  });

  it('picks the last overlapping viewport, matching paint order', () => {
    const hit = viewportsAt([a, b], OUTER, DIMS, { x: 60, y: 60 })!;
    expect(hit.layer.id).toBe('b');
    expect(hit.point).toEqual({ x: 510, y: 510 });
  });

  it('falls back to the only viewport containing the point', () => {
    const hit = viewportsAt([a, b], OUTER, DIMS, { x: 10, y: 10 })!;
    expect(hit.layer.id).toBe('a');
    expect(hit.point).toEqual({ x: 10, y: 10 });
  });

  it('returns null when no viewport contains the point', () => {
    expect(viewportsAt([a, b], OUTER, DIMS, { x: 300, y: 300 })).toBeNull();
  });
});
