import { describe, it, expect } from 'vitest';
import { parseColor } from './color';

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
