import { describe, expect, it } from 'vitest';
import { composeAffordanceLayer } from './composeAffordanceLayer';
import type { Affordance, AffordanceRegion } from './types';
import { PATH_M, PATH_Z } from '@weasel-js/geom';
import type { ChromeState } from 'core/selection/chromeState';

// What the layer paints and what it lets a press reach are the same chrome.

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 200, height: 200, dpr: 1 };
const STATE: ChromeState = {
  selection: [], multiActive: false, boundsOf: () => null, unionBounds: null, modifiers: NO_MOD,
};

type AnnulusShape = Extract<AffordanceRegion['shape'], { kind: 'annulus' }>;

function ringLayer(shape: AnnulusShape) {
  const a: Affordance = {
    id: 'ring',
    regions: () => [{
      id: 'r', targetId: null, shape,
      paint: { kind: 'annulus', fill: { paint: { color: 'red' } } },
      bind: () => ({}),
    }],
  };
  return composeAffordanceLayer('x', 'X', [a]);
}

/** Nonzero winding of the layer's one polygon around a screen point. */
function painted(layer: ReturnType<typeof ringLayer>, x: number, y: number): boolean {
  const cmd = layer.draw(STATE, VIEW, DIMS)[0] as { path: { commands: Uint8Array; coords: Float32Array } } | undefined;
  if (!cmd) return false;
  const { commands, coords } = cmd.path;
  let winding = 0;
  let start = 0;
  const edge = (i: number, j: number) => {
    const x0 = coords[i * 2]!, y0 = coords[i * 2 + 1]!, x1 = coords[j * 2]!, y1 = coords[j * 2 + 1]!;
    const side = (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0);
    if (y0 <= y && y1 > y && side > 0) winding++;
    else if (y0 > y && y1 <= y && side < 0) winding--;
  };
  let pt = 0;
  for (const c of commands) {
    if (c === PATH_M) { start = pt; pt++; continue; }
    if (c === PATH_Z) { edge(pt - 1, start); continue; }
    edge(pt - 1, pt);
    pt++;
  }
  return winding !== 0;
}

const hit = (layer: ReturnType<typeof ringLayer>, x: number, y: number) =>
  layer.hitTest(x, y, STATE, VIEW, DIMS) !== null;

describe('composeAffordanceLayer paint matches hit', () => {
  it('paints an annulus around its inner rect where it sits, not centered on the ellipse', () => {
    // Inner rect spans x 40..80, so it is off the ellipse's center by 10 on x.
    const layer = ringLayer({ kind: 'annulus', cx: 50, cy: 50, rx: 40, ry: 40, innerX: 40, innerY: 30, innerWidth: 40, innerHeight: 40 });
    for (const [x, y] of [[35, 50], [75, 50], [50, 20], [85, 50]] as const) {
      expect([x, y, painted(layer, x, y)]).toEqual([x, y, hit(layer, x, y)]);
    }
    expect(hit(layer, 35, 50)).toBe(true);
    expect(hit(layer, 75, 50)).toBe(false);
  });

  it('floors the band past the inner rect edge farthest from the center', () => {
    const layer = ringLayer({
      kind: 'annulus', cx: 50, cy: 50, rx: 20, ry: 20, innerX: 40, innerY: 40, innerWidth: 40, innerHeight: 20, minBandPx: 10,
    });
    expect(hit(layer, 85, 50)).toBe(true);
    expect(painted(layer, 85, 50)).toBe(true);
  });

  it('fills every corner where the rect corners sit inside the ellipse', () => {
    const layer = ringLayer({
      kind: 'annulus', cx: 50, cy: 50, rx: 20, ry: 20, innerX: 30, innerY: 30, innerWidth: 40, innerHeight: 40, minBandPx: 30,
    });
    for (const [x, y] of [[75, 25], [25, 25], [75, 75], [25, 75]] as const) {
      expect([x, y, hit(layer, x, y), painted(layer, x, y)]).toEqual([x, y, true, true]);
    }
  });

  it('does not paint a region whose own chromeId is hidden, as it cannot be hit', () => {
    const a: Affordance = {
      id: 'aff',
      regions: () => [{
        id: 'r',
        targetId: null,
        chromeId: 'part',
        shape: { kind: 'point', x: 10, y: 10, hitRadiusPx: 4 },
        paint: { kind: 'square', sizePx: 4, fill: { paint: { color: 'red' } } },
        bind: () => ({}),
      }],
    };
    const layer = composeAffordanceLayer('x', 'X', [a]);
    const data = { getChromeState: () => STATE, getIsVisible: () => (id: string) => id !== 'part' };
    expect(layer.hitTest(10, 10, data, VIEW, DIMS)).toBeNull();
    expect(layer.draw(data, VIEW, DIMS)).toHaveLength(0);
  });
});
