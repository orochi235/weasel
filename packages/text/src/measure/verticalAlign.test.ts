import { describe, it, expect } from 'vitest';
import { verticalAlignOffset } from './verticalAlign';

describe('verticalAlignOffset', () => {
  it('returns 0 for top/undefined align or missing box height', () => {
    expect(verticalAlignOffset('top', 100, 40)).toBe(0);
    expect(verticalAlignOffset(undefined, 100, 40)).toBe(0);
    expect(verticalAlignOffset('center', undefined, 40)).toBe(0);
  });
  it('centers and bottoms within the box', () => {
    expect(verticalAlignOffset('center', 100, 40)).toBe(30);
    expect(verticalAlignOffset('bottom', 100, 40)).toBe(60);
  });
  it('goes negative when text overflows the box (block extends above)', () => {
    expect(verticalAlignOffset('center', 40, 100)).toBe(-30);
    expect(verticalAlignOffset('bottom', 40, 100)).toBe(-60);
  });
});
