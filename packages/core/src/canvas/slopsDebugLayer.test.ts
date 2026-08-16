import { describe, it, expect } from 'vitest';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { HANDLE_HIT_RADIUS } from './affordanceAt';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';

function layerFor(bounds: Bounds) {
  const selection = { current: ['a'] } as unknown as SelectionApi;
  return createSlopsDebugLayer({
    selectionRef: { current: selection },
    boundsOf: () => bounds,
    getEditingId: () => null,
    getPose: () => null,
  });
}

/** Radius of the first drawn slop circle. `circlePath` emits a 4-arc
 *  approximation whose x-extent is the diameter, so half the coord span is
 *  the radius regardless of how the curve is discretized. */
function firstSlopRadius(cmds: readonly unknown[]): number {
  const cmd = cmds[0] as { path: { coords: ArrayLike<number> } };
  const xs: number[] = [];
  for (let i = 0; i < cmd.path.coords.length; i += 2) xs.push(cmd.path.coords[i]);
  return (Math.max(...xs) - Math.min(...xs)) / 2;
}

describe('slopsDebugLayer', () => {
  // The halo must match the real hit zone, which `hitAffordanceRegions`
  // resolves from a screen-px radius. Scaling it here made the overlay
  // disagree with the pipeline it exists to visualize.
  it('draws handle slops at the screen-px hit radius, unscaled by zoom', () => {
    const layer = layerFor({ x: 0, y: 0, width: 100, height: 100 });
    for (const scale of [0.25, 1, 4]) {
      const cmds = layer.draw(null, { x: 0, y: 0, scale: { x: scale, y: scale } } as never, {
        width: 800, height: 600,
      } as never);
      expect(firstSlopRadius(cmds)).toBeCloseTo(HANDLE_HIT_RADIUS, 5);
    }
  });
});
