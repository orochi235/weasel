import { describe, it, expect } from 'vitest';
import { parseBmFont, FIXTURE_FONT } from './FontAtlas';

describe('parseBmFont', () => {
  it('parses a valid BmFont JSON object', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.info.face).toBe('Inter');
    expect(font.common.lineHeight).toBe(38);
    expect(font.chars).toHaveLength(2);
    expect(font.kernings).toHaveLength(1);
  });

  it('indexes chars by codepoint for O(1) lookup', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.charMap.get(65)).toMatchObject({ id: 65, xadvance: 23 });
    expect(font.charMap.get(66)).toMatchObject({ id: 66, xadvance: 22 });
    expect(font.charMap.get(99)).toBeUndefined();
  });

  it('indexes kernings as map[first][second]', () => {
    const font = parseBmFont(FIXTURE_FONT);
    expect(font.kerningMap.get(65)?.get(66)).toBe(-1);
    expect(font.kerningMap.get(65)?.get(67)).toBeUndefined();
  });

  it('throws on missing required fields', () => {
    expect(() => parseBmFont({})).toThrow();
    expect(() => parseBmFont({ info: {}, common: {}, chars: 'not-array' })).toThrow();
  });

  it('accepts JSON with no kernings array (defaults to [])', () => {
    const noKern = { ...FIXTURE_FONT, kernings: undefined };
    const font = parseBmFont(noKern);
    expect(font.kernings).toHaveLength(0);
    expect(font.kerningMap.size).toBe(0);
  });
});
