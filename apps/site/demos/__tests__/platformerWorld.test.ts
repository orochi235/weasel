// apps/site/demos/__tests__/platformerWorld.test.ts
import { describe, it, expect } from 'vitest';
import { SOLID, TILE, tileAt, toCol, toRow } from '../platformer/level';
import { WORLD } from '../platformer/worldLevel';

describe('WORLD', () => {
  it('is 80 by 16 tiles', () => {
    expect(WORLD.cols).toBe(80);
    expect(WORLD.rows).toBe(16);
  });

  it('spawns the player standing on solid ground', () => {
    const below = tileAt(WORLD, toCol(WORLD.spawn.x), toRow(WORLD.spawn.y) + 1);
    expect(below).toBe(SOLID);
  });

  it('has a goal to the right of the spawn', () => {
    expect(WORLD.goal.x).toBeGreaterThan(WORLD.spawn.x + 40 * TILE);
  });

  it('has coins and enemies to find', () => {
    expect(WORLD.coins.length).toBeGreaterThanOrEqual(6);
    expect(WORLD.enemies.length).toBeGreaterThanOrEqual(3);
  });

  it('gives every enemy solid ground under its feet', () => {
    for (const e of WORLD.enemies) {
      expect(tileAt(WORLD, toCol(e.x), toRow(e.y) + 1), `enemy at ${e.x},${e.y}`).toBe(SOLID);
    }
  });
});
