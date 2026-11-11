/** Counterexamples `FontAtlas.pbt.test.ts` shrank to, kept as examples. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBmFont } from './FontAtlas';

const doc = (char: unknown, kerning?: unknown) => ({
  info: { face: '', size: 1 }, common: { lineHeight: 0, base: 0, scaleW: 512, scaleH: 512 },
  chars: [char], kernings: kerning === undefined ? [] : [kerning],
});
const char = { id: 0, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 };

describe('parseBmFont, shrunk', () => {
  it('refuses a glyph whose offset is not a number, naming it', () => {
    expect(() => parseBmFont(doc({ ...char, yoffset: NaN }))).toThrow('parseBmFont: chars[0].yoffset must be a finite number');
  });

  it('refuses a glyph or a kerning that is not an object', () => {
    expect(() => parseBmFont(doc(null))).toThrow('parseBmFont: chars[0] must be an object');
    expect(() => parseBmFont(doc(char, { first: 1, second: 2 }))).toThrow('parseBmFont: kernings[0].amount must be a finite number');
  });

  it('reads the repo\'s Inter atlas', () => {
    const raw = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.json'), 'utf8'));
    expect(parseBmFont(raw).chars.length).toBeGreaterThan(50);
  });
});
