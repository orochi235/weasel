import { describe, expect, it } from 'vitest';
import { hexToOklchDeg } from '@weasel-js/core';
import { colorRamp, rampColor } from './ramp';
import { chromaAt, oklchToHex, type ChromaCurve } from './oklch';

describe('colorRamp', () => {
  it('defaults to OKLCH, matching oklchToHex at the lerped L/C/H', () => {
    const from = oklchToHex(0.3, 0.1, 250);
    const to = oklchToHex(0.9, 0.1, 250);
    const a = hexToOklchDeg(from);
    const b = hexToOklchDeg(to);
    const mid = oklchToHex((a.L + b.L) / 2, (a.C + b.C) / 2, (a.H + b.H) / 2);
    expect(rampColor(from, to, 0.5)).toBe(mid);
    expect(rampColor(from, to, 0.5, { space: 'oklch' })).toBe(mid);
  });

  it('keeps both endpoints exact in every space', () => {
    for (const space of ['oklch', 'oklab', 'hsl', 'srgb', 'srgb-linear'] as const) {
      const r = colorRamp('#1d3b8a', '#f6e7a1', 5, { space });
      expect(r).toHaveLength(5);
      expect(r[0]).toBe('#1d3b8a');
      expect(r[4]).toBe('#f6e7a1');
    }
  });

  it.each([
    ['srgb',        '#800080'],
    ['srgb-linear', '#bc00bc'],
    ['hsl',         '#ff00ff'],
    ['oklab',       '#8c53a2'],
  ] as const)('%s: #ff0000 → #0000ff midpoint is %s', (space, mid) => {
    expect(colorRamp('#ff0000', '#0000ff', 3, { space })[1]).toBe(mid);
  });

  it('a one-step ramp is its start, a zero-step ramp is empty', () => {
    expect(colorRamp('#ff0000', '#0000ff', 1)).toEqual(['#ff0000']);
    expect(colorRamp('#ff0000', '#0000ff', 0)).toEqual([]);
  });

  describe('chroma curve', () => {
    const curve: ChromaCurve = { lRange: [0.2, 0.95], midL: 0.6, cBot: 0.03, cPeak: 0.15, cTop: 0.03 };

    it('replaces each sample\'s chroma with the curve at its lightness, in any space', () => {
      for (const space of ['oklch', 'srgb'] as const) {
        const hex = rampColor('#20304a', '#e8eef8', 0.5, { space, chroma: curve });
        const s = hexToOklchDeg(hex);
        expect(s.C).toBeCloseTo(chromaAt(s.L, curve), 2);
      }
    });

    it('lends a gray ramp the curve chroma', () => {
      const hex = rampColor('#303030', '#d0d0d0', 0.5, { chroma: curve });
      expect(hexToOklchDeg(hex).C).toBeGreaterThan(0.1);
    });
  });
});
