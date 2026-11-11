import { describe, expect, it, vi } from 'vitest';
import { drawOneLayer } from '@weasel-js/core';
import { tiledProject } from './tiledProject';
import { createTiledLayer } from './createTiledLayer';
import { createParallaxLayer } from './createParallaxLayer';
import { createParallaxPlane } from './createParallaxPlane';
import { nonFinite, recordingSource } from './pbt.fixture';

describe('shrunk from the tiling properties', () => {
  it('names the cell a range starts in when the quotient rounds to the next one', () => {
    // -5e-324 / 2 rounds to -0, which floored left cell -1 out.
    expect(tiledProject(0, 0, 2, 5e-324)).toEqual({ from: -1, to: 0 });
  });

  it('draws nothing of a world source through a plane too deep for a finite view', () => {
    const world = recordingSource('world');
    const screen = recordingSource('screen');
    const tiled = createTiledLayer({ id: 't', label: 't', source: [world.layer, screen.layer], period: 0.001 });
    const plane = createParallaxLayer({ id: 'p', label: 'p', source: [tiled, screen.layer], parallax: { pan: { x: 1e300, y: 0 }, zoom: -1e300 } });
    const out = drawOneLayer(plane, undefined, { x: 1e6, y: 0, scale: { x: 0.05, y: 0.05 } }, { width: 1, height: 1, dpr: 1 });
    expect(nonFinite(out)).toEqual([]);
    expect(world.views).toEqual([]);
    expect(out).toHaveLength(1);
  });

  it('does not notify for a write that changes nothing', () => {
    const plane = createParallaxPlane({ pan: 0 });
    const fn = vi.fn();
    plane.subscribe(fn);
    const before = plane.get();
    plane.set({});
    plane.set({ pan: 0 });
    expect(fn).not.toHaveBeenCalled();
    expect(plane.get()).toBe(before);
  });

  it('draws a screen source inside a lattice under a view zoomed to 0 as nothing, not through an infinite inverse', () => {
    const screen = recordingSource('screen');
    const tiled = createTiledLayer({ id: 't', label: 't', source: [screen.layer], period: 0 });
    const out = drawOneLayer(tiled, undefined, { x: 0, y: 0, scale: { x: 0.05, y: 0 } }, { width: 0, height: 0, dpr: 1 });
    expect(nonFinite(out)).toEqual([]);
  });
});
