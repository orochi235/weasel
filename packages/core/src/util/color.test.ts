import { describe, it, expect } from 'vitest';
import { toHex8, getAlpha01, withAlpha01, mergeAlphaFromPrev } from './color';

describe('toHex8', () => {
  it('expands #rgb to #rrggbbff', () => {
    expect(toHex8('#abc')).toBe('#aabbccff');
  });
  it('expands #rrggbb to #rrggbbff', () => {
    expect(toHex8('#aabbcc')).toBe('#aabbccff');
  });
  it('returns #rrggbbaa unchanged (lowercased)', () => {
    expect(toHex8('#aabbccdd')).toBe('#aabbccdd');
  });
  it('passes through non-hex', () => {
    expect(toHex8('rgb(1,2,3)')).toBe('rgb(1,2,3)');
  });
});

describe('getAlpha01', () => {
  it('reads alpha from hex8', () => {
    expect(getAlpha01('#aabbcc80')).toBeCloseTo(0x80 / 255);
  });
  it('returns 1 for hex without alpha', () => {
    expect(getAlpha01('#aabbcc')).toBe(1);
  });
  it('returns 1 for non-hex', () => {
    expect(getAlpha01('red')).toBe(1);
  });
});

describe('withAlpha01', () => {
  it('replaces alpha', () => {
    expect(withAlpha01('#aabbccff', 0.5)).toBe('#aabbcc80');
  });
  it('clamps below 0', () => {
    expect(withAlpha01('#aabbccff', -1)).toBe('#aabbcc00');
  });
  it('clamps above 1', () => {
    expect(withAlpha01('#aabbcc00', 2)).toBe('#aabbccff');
  });
  it('passes through non-hex', () => {
    expect(withAlpha01('red', 0.5)).toBe('red');
  });
});

describe('mergeAlphaFromPrev', () => {
  it('keeps explicit alpha from picked when length is 9 (lowercased)', () => {
    expect(mergeAlphaFromPrev('#aabbcc80', '#000000ff')).toBe('#aabbcc80');
  });
  it('lowercases an already-8-char picked color', () => {
    expect(mergeAlphaFromPrev('#AABBCC80', '#000000ff')).toBe('#aabbcc80');
  });
  it('borrows alpha from prev when picked is 7-char', () => {
    expect(mergeAlphaFromPrev('#aabbcc', '#11223380')).toBe('#aabbcc80');
  });
});
