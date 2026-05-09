import { describe, it, expect } from 'vitest';
import { parseColor, parseColorToRgba255 } from './color';

describe('parseColorToRgba255', () => {
  it('returns integer 0..255 components for #ffffff', () => {
    expect(parseColorToRgba255('#ffffff')).toEqual([255, 255, 255, 255]);
  });

  it('returns [0,0,0,255] for #000000', () => {
    expect(parseColorToRgba255('#000000')).toEqual([0, 0, 0, 255]);
  });

  it('handles rgba with fractional alpha', () => {
    const [r, g, b, a] = parseColorToRgba255('rgba(255, 0, 0, 0.5)');
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
    expect(a).toBeGreaterThanOrEqual(127);
    expect(a).toBeLessThanOrEqual(128);
  });
});

describe('parseColor', () => {
  it('parses #rrggbb', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#00ff00')).toEqual([0, 1, 0, 1]);
    expect(parseColor('#0000ff')).toEqual([0, 0, 1, 1]);
  });

  it('parses #rgb', () => {
    expect(parseColor('#f00')).toEqual([1, 0, 0, 1]);
  });

  it('parses #rrggbbaa', () => {
    const c = parseColor('#ff000080');
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBeCloseTo(0x80 / 255, 2);
  });

  it('parses rgb(r, g, b)', () => {
    const c = parseColor('rgb(255, 128, 0)');
    expect(c[0]).toBe(1);
    expect(c[1]).toBeCloseTo(0.502, 2);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('parses rgba(r, g, b, a)', () => {
    const c = parseColor('rgba(0, 0, 0, 0.5)');
    expect(c).toEqual([0, 0, 0, 0.5]);
  });

  it('throws on unrecognized input', () => {
    expect(() => parseColor('lemonchiffon')).toThrow();
  });
});
