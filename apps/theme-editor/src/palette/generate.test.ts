import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS, generate, YELLOW_ANCHOR, type Constraints } from './generate';
import { contrast, hueGap } from './oklch';

const withC = (over: Partial<Constraints>): Constraints => ({ ...DEFAULT_CONSTRAINTS, ...over });

describe('generate', () => {
  it('returns the requested number of swatches', () => {
    for (const count of [5, 8, 10, 12]) {
      expect(generate(withC({ count })).swatches).toHaveLength(count);
    }
  });

  it('honors the hue-gap floor', () => {
    // Contrast off, so this isolates the one gate under test.
    const { swatches, feasible } = generate(withC({ count: 8, minHueGap: 40, minContrast: 0 }));
    expect(feasible).toBe(true);
    for (let i = 0; i < swatches.length; i += 1) {
      for (let j = i + 1; j < swatches.length; j += 1) {
        expect(hueGap(swatches[i].lch.H, swatches[j].lch.H)).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('honors the contrast floor against the surface', () => {
    const { swatches, feasible } = generate(withC({ count: 8, minHueGap: 0, minContrast: 4.5 }));
    expect(feasible).toBe(true);
    for (const s of swatches) expect(contrast(s.hex, '#181a1e')).toBeGreaterThanOrEqual(4.5);
  });

  it('meets both gates together at the settings this palette work landed on', () => {
    const { swatches, feasible, stats } = generate(DEFAULT_CONSTRAINTS);
    expect(feasible).toBe(true);
    expect(stats.minHueGap).toBeGreaterThanOrEqual(DEFAULT_CONSTRAINTS.minHueGap);
    expect(stats.minContrast).toBeGreaterThanOrEqual(DEFAULT_CONSTRAINTS.minContrast);
    expect(swatches).toHaveLength(10);
  });

  it('reports infeasible rather than throwing when the gates cannot be met', () => {
    // 12 hues cannot all sit 40 degrees apart: 12 * 40 exceeds the circle.
    expect(generate(withC({ count: 12, minHueGap: 40 })).feasible).toBe(false);
  });

  it('places an anchored hue at the lightness it was pinned to', () => {
    const { swatches } = generate(withC({ count: 10, anchors: [YELLOW_ANCHOR] }));
    const yellow = swatches.find((s) => s.anchored);
    expect(yellow).toBeDefined();
    expect(yellow!.lch.L).toBeCloseTo(YELLOW_ANCHOR.lightness, 2);
    expect(hueGap(yellow!.lch.H, YELLOW_ANCHOR.hue)).toBeLessThan(2);
  });

  it('keeps an anchor that the unanchored law would have excluded', () => {
    // Without the anchor the lightness law never reaches the L where hue 110
    // still reads as yellow, so nothing lands above 0.86 at that hue.
    const free = generate(withC({ count: 10 }));
    const nearYellow = free.swatches.filter((s) => hueGap(s.lch.H, 110) < 12);
    expect(nearYellow.every((s) => s.lch.L < 0.86)).toBe(true);

    const pinned = generate(withC({ count: 10, anchors: [YELLOW_ANCHOR] }));
    expect(pinned.swatches.some((s) => hueGap(s.lch.H, 110) < 12 && s.lch.L > 0.86)).toBe(true);
  });

  it('narrows the chroma spread as equalize rises', () => {
    const at = (equalize: number) => generate(withC({ equalize })).stats.chromaSpread;
    expect(at(0.5)).toBeLessThan(at(0));
    expect(at(1)).toBeLessThan(at(0.5));
  });

  it('orders farthest-first so a prefix stays separated', () => {
    const { swatches } = generate(withC({ count: 10, order: 'farthest' }));
    const gapAcross = (n: number) => {
      let min = 360;
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          min = Math.min(min, hueGap(swatches[i].lch.H, swatches[j].lch.H));
        }
      }
      return min;
    };
    expect(gapAcross(3)).toBeGreaterThan(gapAcross(10));
    expect(gapAcross(3)).toBeGreaterThan(60);
  });

  it('gives every swatch a distinct name', () => {
    const names = generate(withC({ count: 12, minHueGap: 28 })).swatches.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('feasibility reporting', () => {
  it('cannot report feasible when the gate is geometrically impossible', () => {
    // 16 hues at a 32 degree floor needs 512 degrees of circle.
    const p = generate(withC({ count: 16, minHueGap: 32, minContrast: 0 }));
    expect(p.feasible).toBe(false);
  });

  it('reports the realized gap, not the requested one', () => {
    const p = generate(withC({ count: 16, minHueGap: 32, minContrast: 4 }));
    if (p.feasible) {
      expect(p.stats.minHueGap).toBeGreaterThanOrEqual(32);
      expect(p.stats.minContrast).toBeGreaterThanOrEqual(4);
    }
  });

  it('stays feasible with two anchors at a gap the set can hold', () => {
    const p = generate(
      withC({
        count: 8,
        minHueGap: 30,
        minContrast: 0,
        anchors: [
          { name: 'yellow', hue: 110, lightness: 0.88 },
          { name: 'violet', hue: 292, lightness: 0.53 },
        ],
      }),
    );
    expect(p.feasible).toBe(true);
    expect(p.stats.minHueGap).toBeGreaterThanOrEqual(30);
  });
});
