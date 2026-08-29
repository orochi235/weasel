import { describe, it, expect } from 'vitest';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { targetSizesPx } from 'core/device/targets';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { COARSE_TARGET_SCALE } from 'core/device/profile';

function layerFor(bounds: Bounds, targetScale?: number) {
  const selection = { current: ['a'] } as unknown as SelectionApi;
  return createSlopsDebugLayer({
    selectionRef: { current: selection },
    boundsOf: () => bounds,
    getEditingId: () => null,
    getPose: () => null,
    ...(targetScale !== undefined ? { targetScale } : {}),
  });
}

function drawAt(layer: ReturnType<typeof layerFor>, scale: number): readonly unknown[] {
  return layer.draw(null, { x: 0, y: 0, scale: { x: scale, y: scale } } as never, {
    width: 800, height: 600,
  } as never);
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
      expect(firstSlopRadius(drawAt(layer, scale))).toBeCloseTo(targetSizesPx().handle, 5);
    }
  });

  // The overlay's one job is not to lie: a coarse pointer's real grab zone is
  // device-scaled, so the halo must be too.
  it('draws coarse-pointer slops at the device-scaled hit radius', () => {
    const layer = layerFor({ x: 0, y: 0, width: 100, height: 100 }, COARSE_TARGET_SCALE);
    expect(firstSlopRadius(drawAt(layer, 1))).toBeCloseTo(targetSizesPx(COARSE_TARGET_SCALE).handle, 5);
  });
});
