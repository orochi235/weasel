import { describe, it, expect } from 'vitest';
import { SHIPPED_TAGS, IMPLICIT_TAGS, isShippedTag } from './capabilities';

describe('capabilities', () => {
  it('SHIPPED_TAGS includes the documented capability vocabulary', () => {
    expect(SHIPPED_TAGS).toContain('navigation');
    expect(SHIPPED_TAGS).toContain('creates-selection');
    expect(SHIPPED_TAGS).toContain('creates-paths');
    expect(SHIPPED_TAGS).toContain('creates-shapes');
    expect(SHIPPED_TAGS).toContain('creates-text');
    expect(SHIPPED_TAGS).toContain('edits-anchors');
    expect(SHIPPED_TAGS).toContain('edits-text');
    expect(SHIPPED_TAGS).toContain('transforms-selection');
    expect(SHIPPED_TAGS).toContain('samples-color');
    expect(SHIPPED_TAGS).toContain('applies-fill');
    expect(SHIPPED_TAGS).toContain('edits-page');
  });

  it('IMPLICIT_TAGS contains navigation only', () => {
    expect(IMPLICIT_TAGS).toEqual(['navigation']);
  });

  it('isShippedTag narrows correctly', () => {
    expect(isShippedTag('creates-selection')).toBe(true);
    expect(isShippedTag('not-a-tag')).toBe(false);
  });
});
