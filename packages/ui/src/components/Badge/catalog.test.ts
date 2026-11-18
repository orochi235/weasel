import { describe, expect, it } from 'vitest';
import {
  BADGE_BASES, BADGE_EFFECTS, BADGE_SHAPES, badgeBaseDefaults, badgeEffectDefaults, badgeEffectZone,
  badgeShapeDefaults, badgeShapeRendering,
} from '@weasel-js/ui/components/Badge';

describe('the badge catalog', () => {
  it('names each shape, base, and effect once', () => {
    for (const list of [BADGE_SHAPES, BADGE_BASES, BADGE_EFFECTS]) expect(new Set(list).size).toBe(list.length);
    expect(BADGE_SHAPES).toContain('pill');
    expect(BADGE_BASES).toContain('octant-bspline');
    expect(BADGE_EFFECTS).toContain('metal');
  });

  it('says how each shape is drawn', () => {
    expect(badgeShapeRendering('pill')).toBe('css');
    expect(badgeShapeRendering('plain')).toBe('css');
    expect(badgeShapeRendering('quatrefoil')).toBe('composed');
    expect(badgeShapeRendering('urn')).toBe('svg');
  });

  it('puts an effect that moves the outline in the offset zone, and the rest where they paint', () => {
    expect(badgeEffectZone('spikes')).toBe('offset');
    expect(badgeEffectZone('shadow')).toBe('background');
    expect(badgeEffectZone('perforations')).toBe('mask');
    expect(badgeEffectZone('sheen')).toBe('foreground');
  });

  it('gives the params each shape, base, and effect draws with when none are set, as a copy', () => {
    expect(badgeShapeDefaults('ribbon')).toEqual({ left: 'inward', right: 'outward', taperWidth: 8 });
    expect(badgeShapeDefaults('pill')).toEqual({});
    expect(badgeBaseDefaults('chamfered-rect')).toHaveProperty('chamfer');
    expect(badgeEffectDefaults('shadow')).toEqual({ dx: 1, dy: 2, opacity: 0.28 });
    (badgeEffectDefaults('shadow') as Record<string, unknown>).dx = 9;
    expect(badgeEffectDefaults('shadow')).toHaveProperty('dx', 1);
  });
});
