// apps/site/demos/__tests__/platformerLevel.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, tileAt, SOLID, ONEWAY, SPIKE, EMPTY, TILE } from '../platformer/level';

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

  it('reads out of bounds as solid above the floor and empty above the ceiling', () => {
    const level = parseLevel(ROWS);
    expect(tileAt(level, -1, 0)).toBe(SOLID);
    expect(tileAt(level, 5, 0)).toBe(SOLID);
    expect(tileAt(level, 0, -1)).toBe(EMPTY);
    expect(tileAt(level, 0, 5)).toBe(EMPTY);
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel(['##', '#'])).toThrow(/ragged/i);
  });
});
