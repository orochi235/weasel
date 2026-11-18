// apps/site/demos/__tests__/platformerLevel.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, tileAt, SOLID, ONEWAY, SPIKE, QUESTION, EMPTY, TILE } from '../platformer/level';

/** A geometry fixture: no spawn or goal needed. */
const fixture = (rows: string[]) => parseLevel(rows, { markers: 'optional' });

const ROWS = [
  '....G',
  '.o.e.',
  '..=..',
  'S....',
  '#^###',
];

describe('parseLevel', () => {
  it('sizes the grid from the rows', () => {
    const level = parseLevel(ROWS);
    expect(level.cols).toBe(5);
    expect(level.rows).toBe(5);
    expect(level.widthPx).toBe(5 * TILE);
    expect(level.heightPx).toBe(5 * TILE);
  });

  it('keeps only geometry in the tile grid', () => {
    const level = parseLevel(ROWS);
    expect(tileAt(level, 0, 4)).toBe(SOLID);
    expect(tileAt(level, 1, 4)).toBe(SPIKE);
    expect(tileAt(level, 2, 2)).toBe(ONEWAY);
    // coin, enemy, spawn and goal cells are walkable air
    expect(tileAt(level, 1, 1)).toBe(EMPTY);
    expect(tileAt(level, 3, 1)).toBe(EMPTY);
    expect(tileAt(level, 0, 3)).toBe(EMPTY);
    expect(tileAt(level, 4, 0)).toBe(EMPTY);
  });

  it('lifts entities out to world-space centers', () => {
    const level = parseLevel(ROWS);
    expect(level.spawn).toEqual({ x: 0.5 * TILE, y: 3.5 * TILE });
    expect(level.goal).toEqual({ x: 4.5 * TILE, y: 0.5 * TILE });
    expect(level.coins).toEqual([{ x: 1.5 * TILE, y: 1.5 * TILE }]);
    expect(level.enemies).toEqual([{ x: 3.5 * TILE, y: 1.5 * TILE }]);
  });

  it('walls the sides and leaves the top and bottom open', () => {
    const level = parseLevel(ROWS);
    expect(tileAt(level, -1, 0)).toBe(SOLID);
    expect(tileAt(level, 5, 0)).toBe(SOLID);
    expect(tileAt(level, 0, -1)).toBe(EMPTY);
    expect(tileAt(level, 0, 5)).toBe(EMPTY);
  });

  it('rejects ragged rows', () => {
    expect(() => fixture(['##', '#'])).toThrow(/ragged/i);
  });

  it('rejects an unknown glyph instead of silently reading it as air', () => {
    expect(() => fixture(['..', '.x'])).toThrow(/unknown glyph "x".*column 1.*row 1/i);
  });

  it('throws on a level with no spawn or no goal', () => {
    expect(() => parseLevel(['..G', '###'])).toThrow(/no "S"/);
    expect(() => parseLevel(['S..', '###'])).toThrow(/no "G"/);
  });

  it('throws on a second spawn or goal, naming both', () => {
    expect(() => parseLevel(['S.SG', '####'])).toThrow(/second "S" at column 2, row 0.*first is at column 0, row 0/);
    expect(() => parseLevel(['SG.G', '####'])).toThrow(/second "G"/);
  });

  it('lets a geometry fixture leave the markers out, but never duplicate one', () => {
    expect(fixture(['...', '###']).spawn).toEqual({ x: 0, y: 0 });
    expect(() => fixture(['S.S', '###'])).toThrow(/second "S"/);
  });

  it('parses a `?` block as solid, distinct question geometry', () => {
    const level = fixture(['.?.', '###']);
    expect(tileAt(level, 1, 0)).toBe(QUESTION);
    expect(tileAt(level, 1, 0)).not.toBe(SOLID);
  });
});
