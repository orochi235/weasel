import { describe, expect, it } from 'vitest';
import {
  BADGE_BASES, BADGE_EFFECTS, BADGE_SHAPES, badgeEffectZone, badgeShapeRendering,
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
});
