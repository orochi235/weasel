import { describe, expect, it } from 'vitest';
import { contrastLineColor } from './contrast';
import { hexToOklchDeg } from './colorSpaces';

const L = (hex: string): number => hexToOklchDeg(hex.slice(0, 7)).L;

describe('contrastLineColor', () => {
  it('darkens a light background by the strength, in OKLab lightness', () => {
    const line = contrastLineColor('#ffffff', 0.1);
    expect(L(line)).toBeCloseTo(0.9, 2);
  });

  it('lightens a dark background, so dark paper still shows its lines', () => {
    const line = contrastLineColor('#101010', 0.2);
    expect(L(line)).toBeCloseTo(L('#101010') + 0.2, 2);
  });

  it('keeps the background hue, so a tinted page gets tinted lines', () => {
    const bg = '#1e3a8a';
    const line = hexToOklchDeg(contrastLineColor(bg, 0.15));
    expect(line.H).toBeCloseTo(hexToOklchDeg(bg).H, 0);
    expect(line.C).toBeGreaterThan(0.05);
  });

  it('orders strengths: a stronger line sits further from the background', () => {
    const bg = '#f4efe1';
    const faint = Math.abs(L(contrastLineColor(bg, 0.06)) - L(bg));
    const strong = Math.abs(L(contrastLineColor(bg, 0.14)) - L(bg));
    expect(strong).toBeGreaterThan(faint);
  });

  it('reads #rgb and ignores the background alpha', () => {
    expect(contrastLineColor('#fff', 0.1)).toBe(contrastLineColor('#ffffff', 0.1));
    expect(contrastLineColor('#ffffff80', 0.1)).toBe(contrastLineColor('#ffffff', 0.1));
  });

  it('returns #rrggbb', () => {
    expect(contrastLineColor('#808080', 0.1)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('clamps at the lightness range rather than wrapping', () => {
    expect(L(contrastLineColor('#000000', 2))).toBeCloseTo(1, 2);
  });

  it('falls back to translucent black for a color it cannot read', () => {
    expect(contrastLineColor('papayawhip', 0.1)).toBe('rgba(0, 0, 0, 0.1)');
  });
});
