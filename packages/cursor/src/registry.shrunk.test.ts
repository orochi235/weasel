import { describe, expect, it } from 'vitest';
import { bakeCursor } from './bake';
import type { CursorMarkName } from './glyphs';
import { cursorFor, cursorGlyph } from './registry';

describe('cursorFor, shrunk', () => {
  it('refuses an infinite size as bakeCursor does, where it baked the default 24', () => {
    expect(() => bakeCursor(cursorGlyph('pencil'), { size: Infinity })).toThrow(RangeError);
    expect(() => cursorFor('pencil', { size: Infinity })).toThrow(RangeError);
  });
});
