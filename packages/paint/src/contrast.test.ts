import { describe, expect, it } from 'vitest';
import { contrastLineColor, contrastRatio, wcagLevels } from './contrast';
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

  it('reads a four-digit hex background, ignoring its alpha', () => {
    expect(contrastLineColor('#fff8', 0.1)).toBe(contrastLineColor('#ffffff', 0.1));
  });
});

describe('contrastRatio', () => {
  it('gives 21 for black on white and 1 for a color on itself', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777', '#777')).toBe(1);
  });

  it('is the same whichever color is the text', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('matches the published WCAG figure for #767676 on white', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('reads the forms a computed style comes back in', () => {
    expect(contrastRatio('rgb(0, 0, 0)', 'rgb(255 255 255)')).toBeCloseTo(21, 5);
  });

  it('lays a translucent foreground over the background before comparing', () => {
    expect(contrastRatio('rgba(0, 0, 0, 0)', '#fff')).toBe(1);
  });

  it('is null for a color it cannot parse', () => {
    expect(contrastRatio('papayawhipped', '#fff')).toBeNull();
    expect(contrastRatio('#000', 'oklch(0.5 0.1 20)')).toBeNull();
  });
});

describe('wcagLevels', () => {
  it('passes AA but not AAA at 4.5', () => {
    expect(wcagLevels(4.5, false)).toEqual({ aa: true, aaa: false });
  });

  it('passes both at 7 and neither below 4.5', () => {
    expect(wcagLevels(7, false)).toEqual({ aa: true, aaa: true });
    expect(wcagLevels(4.49, false)).toEqual({ aa: false, aaa: false });
  });

  it('asks 3 and 4.5 of large text', () => {
    expect(wcagLevels(3, true)).toEqual({ aa: true, aaa: false });
    expect(wcagLevels(4.5, true)).toEqual({ aa: true, aaa: true });
    expect(wcagLevels(2.99, true)).toEqual({ aa: false, aaa: false });
  });
});
