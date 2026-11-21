import { expect, it } from 'vitest';
import { keyGlyph } from './keyGlyph';

it('draws a glyph for a named key, upper-cases a character, and keeps a key name as keyLegendFromKey spells it', () => {
  expect(['Escape', 'Return', ' ', 'ArrowUp', 'a'].map(keyGlyph)).toEqual(['⎋', '↵', '␣', '↑', 'A']);
  expect(['Home', 'PageUp', 'F5'].map(keyGlyph)).toEqual(['Home', 'PgUp', 'F5']);
});
