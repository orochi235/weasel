import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('reads the field range msdf-bmfont-xml records', () => {
    const font = parseBmFont({ ...FIXTURE_FONT, distanceField: { fieldType: 'msdf', distanceRange: 4 } });
    expect(font.distanceRange).toBe(4);
    expect(parseBmFont(FIXTURE_FONT).distanceRange).toBeUndefined();
  });

  it('accepts JSON with no kernings array (defaults to [])', () => {
    const noKern = { ...FIXTURE_FONT, kernings: undefined };
    const font = parseBmFont(noKern);
    expect(font.kernings).toHaveLength(0);
    expect(font.kerningMap.size).toBe(0);
  });
});

describe('bundled Inter atlas', () => {
  const json = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.json');

  it('sets text at the widths browsers give the same face', () => {
    // Chromium, WebKit and Firefox, 72px, `font-kerning: normal`, from
    // inter.ttf — the file this atlas is baked from — agree within 0.02px.
    const font = parseBmFont(JSON.parse(readFileSync(json, 'utf8')));
    const width = (s: string) => {
      const cps = [...s].map((ch) => ch.codePointAt(0)!);
      let px = 0;
      cps.forEach((cp, i) => {
        px += font.charMap.get(cp)!.xadvance;
        if (i + 1 < cps.length) px += font.kerningMap.get(cp)?.get(cps[i + 1]) ?? 0;
      });
      return px * (72 / font.info.size);
    };
    expect(width('Hxgd')).toBeCloseTo(179.44, 1);
    expect(width('AVATAR')).toBeCloseTo(269.44, 1);
    expect(width('Wavy Type')).toBeCloseTo(376.35, 1);
  });
});
