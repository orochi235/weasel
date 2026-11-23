import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { gateVerdict, unmetGates, type Stats } from './unmetGates';

const withC = (over: Partial<Constraints>): Constraints => ({ ...DEFAULT_CONSTRAINTS, ...over });
const STATS: Stats = {
  meanChroma: 0.15,
  chromaSpread: 0.02,
  lightnessSpread: 0.2,
  minHueGap: 30,
  hueFloorShare: 0.8,
  minContrast: 3.5,
  minDistance: 0.25,
  minSurfaceDistance: 0.3,
};
const anchor = (hue: number): Anchor => ({ name: `h${hue}`, hue, lightness: 0.7 });

describe('unmetGates', () => {
  it('names the pins, not the gates, when anchors outnumber the colors asked for', () => {
    const c = withC({ count: 5, anchors: [0, 50, 100, 150, 200, 250, 300].map(anchor) });
    const palette = generate(c);
    expect(palette.feasible).toBe(false);
    expect(unmetGates(c, palette.stats)).toEqual(['7 colors are pinned for 5: add 2 more colors or unpin 2']);
  });

  it('calls a distance gate missed by a hair missed, as the generator does', () => {
    const c = withC({ hueFloor: 0, minContrast: 0, minSurfaceDistance: 0, minDistance: 0.22 });
    const stats = { ...STATS, minDistance: 0.217 };
    expect(gateVerdict(c, stats, 'minDistance')).toBe('bad');
    expect(unmetGates(c, stats)).toEqual(['distance between colors reaches 0.217 of 0.22']);
  });

  it('blames two pins closer than the hue floor, which no free hue can fix', () => {
    const c = withC({ count: 6, hueFloor: 0.8, minContrast: 0, minDistance: 0, minSurfaceDistance: 0, anchors: [anchor(20), anchor(30)] });
    const palette = generate(c);
    expect(palette.feasible).toBe(false);
    expect(unmetGates(c, palette.stats).at(-1)).toMatch(/^pinned h20 and h30 sit \d+° apart, so no hue gap can reach 48°$/);
  });
});
