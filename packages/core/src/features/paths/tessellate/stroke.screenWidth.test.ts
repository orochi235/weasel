import { describe, it, expect } from 'vitest';
import { resolveStrokeWidth } from './stroke';

describe('resolveStrokeWidth', () => {
  it('passes a world-unit number through unchanged', () => {
    expect(resolveStrokeWidth(2, 4)).toBe(2);
  });

  it('divides a screen-pixel width by the scale', () => {
    expect(resolveStrokeWidth({ px: 1 }, 4)).toBe(0.25);
  });

  it('holds a screen width constant across scales', () => {
    expect(resolveStrokeWidth({ px: 3 }, 1) * 1).toBeCloseTo(resolveStrokeWidth({ px: 3 }, 10) * 10);
  });

  it('falls back to the raw px value at a degenerate scale', () => {
    expect(resolveStrokeWidth({ px: 1 }, 0)).toBe(1);
  });
});
