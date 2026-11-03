import { describe, expect, it } from 'vitest';
import { BAYER_4X4, bayerCutoff } from './shared';

describe('bayerCutoff', () => {
  it('reads the matrix at (m + 0.5) * 16 for the default threshold', () => {
    expect(bayerCutoff(0, 0, 128)).toBe(8);
    expect(bayerCutoff(1, 0, 128)).toBe((8 + 0.5) * 16);
    expect(bayerCutoff(0, 1, 128)).toBe((12 + 0.5) * 16);
  });

  it('shifts every cell by the threshold offset', () => {
    expect(bayerCutoff(0, 0, 138)).toBe(18);
  });

  it('wraps every 4 dots, negative indexes included', () => {
    expect(bayerCutoff(5, 6, 128)).toBe(bayerCutoff(1, 2, 128));
    expect(bayerCutoff(-1, -1, 128)).toBe(bayerCutoff(3, 3, 128));
  });

  it('holds each of 0–15 once', () => {
    expect([...BAYER_4X4].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });
});
