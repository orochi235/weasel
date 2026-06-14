import { describe, it, expect } from 'vitest';
import { ALL_TAGS, IMPLICIT_TAGS, isCapabilityTag } from './capabilities';

describe('capabilities', () => {
  it('ALL_TAGS includes the documented capability vocabulary', () => {
    expect(ALL_TAGS).toContain('navigation');
    expect(ALL_TAGS).toContain('creates-selection');
    expect(ALL_TAGS).toContain('creates-paths');
    expect(ALL_TAGS).toContain('creates-shapes');
    expect(ALL_TAGS).toContain('creates-text');
    expect(ALL_TAGS).toContain('edits-anchors');
    expect(ALL_TAGS).toContain('edits-text');
    expect(ALL_TAGS).toContain('transforms-selection');
    expect(ALL_TAGS).toContain('samples-color');
    expect(ALL_TAGS).toContain('applies-fill');
    expect(ALL_TAGS).toContain('edits-page');
  });

  it('IMPLICIT_TAGS contains navigation only', () => {
    expect(IMPLICIT_TAGS).toEqual(['navigation']);
  });

  it('isCapabilityTag narrows correctly', () => {
    expect(isCapabilityTag('creates-selection')).toBe(true);
    expect(isCapabilityTag('not-a-tag')).toBe(false);
  });
});
