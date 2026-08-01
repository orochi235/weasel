import { describe, expect, it, vi } from 'vitest';
import { hitAffordanceRegions, annulusSemiAxes } from './hitAffordanceRegions';
import type { Affordance, AffordanceRegion } from './types';
import type { ChromeState } from 'core/selection/chromeState';
import { asNodeId } from 'core/scene/types';

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function state(bounds = { x: 0, y: 0, width: 100, height: 100 }): ChromeState {
  return {
    selection: [asNodeId('a')],
    multiActive: false,
    boundsOf: () => bounds,
    unionBounds: null,
    modifiers: NO_MOD,
  };
}

function pointRegion(
  id: string,
  x: number,
  y: number,
  hitRadiusPx = 8,
): AffordanceRegion {
  return {
    id,
    targetId: null,
    shape: { kind: 'point', x, y, hitRadiusPx },
    hitKind: id,
    bind: () => ({ initialScratch: { id } }),
  };
}

function affordance(id: string, regions: AffordanceRegion[]): Affordance {
  return { id, regions: () => regions };
}

describe('hitAffordanceRegions', () => {
  it('returns null when nothing contains the point', () => {
    const a = affordance('a', [pointRegion('p', 100, 100)]);
    expect(hitAffordanceRegions([a], 0, 0, state(), VIEW)).toBeNull();
  });

  it('reports the affordance id, region id and binding', () => {
    const a = affordance('aff', [pointRegion('r', 10, 10)]);
    const hit = hitAffordanceRegions([a], 10, 10, state(), VIEW);
    expect(hit).toMatchObject({
      affordanceId: 'aff',
      regionId: 'r',
      binding: { initialScratch: { id: 'r' } },
    });
  });

  it('calls bind() exactly once, and only for the winning region', () => {
    const bindLoser = vi.fn(() => ({ initialScratch: 'loser' }));
    const bindWinner = vi.fn(() => ({ initialScratch: 'winner' }));
    const a = affordance('a', [
      { ...pointRegion('loser', 6, 0), bind: bindLoser },
      { ...pointRegion('winner', 1, 0), bind: bindWinner },
    ]);
    const hit = hitAffordanceRegions([a], 0, 0, state(), VIEW);
    expect(hit?.binding.initialScratch).toBe('winner');
    expect(bindWinner).toHaveBeenCalledTimes(1);
    expect(bindLoser).not.toHaveBeenCalled();
  });

  describe('within an affordance, the nearest hit region wins', () => {
    it('picks the nearer of two overlapping point regions', () => {
      // Both contain (0,0) at radius 8, but `far` is declared later — which
      // is what the old "first match in reverse order" walk would have
      // returned.
      const a = affordance('a', [pointRegion('near', 1, 1), pointRegion('far', 6, 6)]);
      expect(hitAffordanceRegions([a], 0, 0, state(), VIEW)?.regionId).toBe('near');
    });

    it('picks the aimed-at corner when a small selection overlaps all four', () => {
      // A 6x6 selection: every corner is within an 8px handle radius of a
      // click anywhere on it. Declaration order used to decide, so one corner
      // answered for all four and the box resized from the wrong anchor.
      const corners = [
        pointRegion('tl', 0, 0),
        pointRegion('tr', 6, 0),
        pointRegion('bl', 0, 6),
        pointRegion('br', 6, 6),
      ];
      const a = affordance('a', corners);
      const at = (x: number, y: number) =>
        hitAffordanceRegions([a], x, y, state(), VIEW)?.regionId;
      expect(at(0, 0)).toBe('tl');
      expect(at(6, 0)).toBe('tr');
      expect(at(0, 6)).toBe('bl');
      expect(at(6, 6)).toBe('br');
    });

    it('breaks an exact tie in favor of the later-declared region', () => {
      const a = affordance('a', [pointRegion('under', 0, 0), pointRegion('over', 0, 0)]);
      expect(hitAffordanceRegions([a], 0, 0, state(), VIEW)?.regionId).toBe('over');
    });
  });

  describe('across affordances, layering wins outright', () => {
    it('prefers the later-declared affordance even when its region is farther', () => {
      const under = affordance('under', [pointRegion('near', 0, 0)]);
      const over = affordance('over', [pointRegion('far', 7, 0)]);
      expect(hitAffordanceRegions([under, over], 0, 0, state(), VIEW)?.affordanceId).toBe('over');
    });

    it('falls through to a lower affordance when the top one misses', () => {
      const under = affordance('under', [pointRegion('hit', 0, 0)]);
      const over = affordance('over', [pointRegion('miss', 500, 500)]);
      expect(hitAffordanceRegions([under, over], 0, 0, state(), VIEW)?.affordanceId).toBe('under');
    });
  });

  describe('visibility gating', () => {
    it('skips an affordance the resolver reports hidden', () => {
      const a = affordance('hidden', [pointRegion('r', 0, 0)]);
      expect(hitAffordanceRegions([a], 0, 0, state(), VIEW, (id) => id !== 'hidden')).toBeNull();
    });

    it('does not call regions() for a hidden affordance', () => {
      const regions = vi.fn(() => [pointRegion('r', 0, 0)]);
      hitAffordanceRegions([{ id: 'hidden', regions }], 0, 0, state(), VIEW, () => false);
      expect(regions).not.toHaveBeenCalled();
    });
  });

  describe('hit radii are screen pixels', () => {
    it('shrinks in world units as the view zooms in', () => {
      const a = affordance('a', [pointRegion('r', 0, 0, 8)]);
      const zoomed = { ...VIEW, scale: { x: 4, y: 4 } };
      // 8 screen px is 8 world units at scale 1, 2 world units at scale 4.
      expect(hitAffordanceRegions([a], 5, 0, state(), VIEW)).not.toBeNull();
      expect(hitAffordanceRegions([a], 5, 0, state(), zoomed)).toBeNull();
      expect(hitAffordanceRegions([a], 1.5, 0, state(), zoomed)).not.toBeNull();
    });
  });

  it('hits a point region square, matching the square handle it paints', () => {
    // The diagonal corner of an 8px handle: |dx| and |dy| are both within
    // radius, but the radial distance (≈11.3) is not. The old classifier used
    // a circle here, so the visible corners of the handle were dead.
    const a = affordance('a', [pointRegion('r', 0, 0, 8)]);
    expect(hitAffordanceRegions([a], 8, 8, state(), VIEW)).not.toBeNull();
    expect(hitAffordanceRegions([a], 9, 0, state(), VIEW)).toBeNull();
  });
});

describe('annulusSemiAxes', () => {
  const base = {
    kind: 'annulus' as const,
    cx: 50, cy: 50, rx: 10, ry: 10,
    innerX: 0, innerY: 0, innerWidth: 100, innerHeight: 100,
  };

  it('passes the declared semi-axes through when no band floor is set', () => {
    expect(annulusSemiAxes(base, VIEW)).toEqual({ rx: 10, ry: 10 });
  });

  it('widens to the inner half-extent plus the band', () => {
    expect(annulusSemiAxes({ ...base, minBandPx: 24 }, VIEW)).toEqual({ rx: 74, ry: 74 });
  });

  it('leaves a naturally larger ellipse alone', () => {
    const big = { ...base, rx: 200, ry: 200, minBandPx: 24 };
    expect(annulusSemiAxes(big, VIEW)).toEqual({ rx: 200, ry: 200 });
  });

  it('converts the band from screen px at the current scale', () => {
    const zoomed = { ...VIEW, scale: { x: 2, y: 2 } };
    expect(annulusSemiAxes({ ...base, minBandPx: 24 }, zoomed)).toEqual({ rx: 62, ry: 62 });
  });
});
