// apps/site/demos/__tests__/platformerWorld.test.ts
import { describe, it, expect } from 'vitest';
import { SOLID, TILE, tileAt, toCol, toRow } from '../platformer/level';
import { WORLD } from '../platformer/worldLevel';
import { freshGame, NO_HOOKS, stepWorld, type GameRefs } from '../platformer/world';

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

describe('stepWorld — damage', () => {
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  const ows = (g: GameRefs) => g.callouts.filter((c) => c.text === 'ow');

  it('says ow when an enemy hits the player', () => {
    const g = freshGame();
    const { x, y } = g.player.body;
    g.enemies = [{ x, y, vx: 0, alive: true, phase: 0 }];
    const lives = g.lives;
    stepWorld(g, idle, NO_HOOKS);
    expect(g.lives).toBe(lives - 1);
    expect(ows(g)).toHaveLength(1);
  });

  it('says ow when the player falls out of the level', () => {
    const g = freshGame();
    g.player = { ...g.player, body: { ...g.player.body, y: WORLD.heightPx + 200 } };
    stepWorld(g, idle, NO_HOOKS);
    expect(ows(g)).toHaveLength(1);
  });
});
