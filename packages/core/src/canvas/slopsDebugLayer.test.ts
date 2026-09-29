import { describe, it, expect } from 'vitest';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { chromeAffordances } from './affordanceAt';
import { targetSizesPx } from 'core/device/targets';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';
import { COARSE_TARGET_SCALE } from '@weasel-js/routing';

function layerFor(targetScale?: number) {
  return createSlopsDebugLayer({
    getAffordances: () => chromeAffordances(targetScale !== undefined ? { targetScale } : {}),
  });
}

/** The draw envelope a view hands its layers — selection and bounds included. */
function envelopeFor(bounds: Bounds) {
  const chromeState: ChromeState = {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => bounds,
    unionBounds: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  };
  return { getChromeState: () => chromeState };
}

function drawAt(
  layer: ReturnType<typeof layerFor>,
  scale: number,
  bounds: Bounds = { x: 0, y: 0, width: 100, height: 100 },
): readonly unknown[] {
  return layer.draw(envelopeFor(bounds), { x: 0, y: 0, scale: { x: scale, y: scale } } as never, {
    width: 800, height: 600,
  } as never);
}

/** Half-extent of the first drawn slop square — the square a point region
 *  hit-tests, axis-aligned here because the target is not turned. */
function firstSlopRadius(cmds: readonly unknown[]): number {
  const c = (cmds[0] as { path: { coords: ArrayLike<number> } }).path.coords;
  return (c[2] - c[0]) / 2;
}

describe('slopsDebugLayer', () => {
  // The halo must match the real hit zone, which `hitAffordanceRegions`
  // resolves from a screen-px radius. Scaling it here made the overlay
  // disagree with the pipeline it exists to visualize.
  it('draws handle slops at the screen-px hit radius, unscaled by zoom', () => {
    const layer = layerFor();
    for (const scale of [0.25, 1, 4]) {
      expect(firstSlopRadius(drawAt(layer, scale))).toBeCloseTo(targetSizesPx().handle, 5);
    }
  });

  // The overlay's one job is not to lie: a coarse pointer's real grab zone is
  // device-scaled, so the halo must be too.
  it('draws coarse-pointer slops at the device-scaled hit radius', () => {
    const layer = layerFor(COARSE_TARGET_SCALE);
    expect(firstSlopRadius(drawAt(layer, 1))).toBeCloseTo(targetSizesPx(COARSE_TARGET_SCALE).handle, 5);
  });
});
