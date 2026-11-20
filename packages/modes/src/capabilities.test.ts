import { describe, it, expect, expectTypeOf } from 'vitest';
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

  it('isShippedTag narrows to the shipped literals and leaves other strings as strings', () => {
    const seen: number[] = [];
    for (const tag of ['edits-text', 'app-tag'] as string[]) {
      if (isShippedTag(tag)) {
        expectTypeOf(tag).toEqualTypeOf<(typeof SHIPPED_TAGS)[number]>();
        seen.push(SHIPPED_TAGS.indexOf(tag));
      } else {
        expectTypeOf(tag).toEqualTypeOf<string>();
        seen.push(tag.length);
      }
    }
    expect(seen).toEqual([SHIPPED_TAGS.indexOf('edits-text'), 'app-tag'.length]);
  });
});
