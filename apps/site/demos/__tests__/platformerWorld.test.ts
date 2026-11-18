// apps/site/demos/__tests__/platformerWorld.test.ts
import { describe, it, expect } from 'vitest';
import { SOLID, TILE, tileAt, toCol, toRow } from '../platformer/level';
import { WORLD } from '../platformer/worldLevel';
import { advanceWorld, freshGame, NO_HOOKS, stepWorld, type GameRefs } from '../platformer/world';
import { BODY_H, STEP } from '../platformer/physics';

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

  /** The player just under WORLD's first `?` block (column 3, row 12), rising into it. */
  const underBlock = (g: GameRefs) => {
    g.player = { ...g.player, body: { ...g.player.body, x: 3.5 * TILE, y: 13 * TILE + BODY_H / 2 + 1, vy: -400 } };
  };

  it('costs a life for a bonk', () => {
    const g = freshGame();
    underBlock(g);
    stepWorld(g, { ...idle, jumpHeld: true }, NO_HOOKS);
    expect(g.lives).toBe(2);
    expect(ows(g)).toHaveLength(1);
  });

  it('costs no life for a bonk while invulnerable, though it still knocks', () => {
    const g = freshGame();
    underBlock(g);
    g.invuln = 1;
    let bonks = 0;
    stepWorld(g, { ...idle, jumpHeld: true }, { ...NO_HOOKS, bonk: () => { bonks++; } });
    expect(bonks).toBe(1);
    expect(g.lives).toBe(3);
    expect(ows(g)).toHaveLength(0);
  });

  it('costs a life for landing in spikes', () => {
    const g = freshGame();
    // WORLD's first spikes are at columns 20 and 21 of row 14.
    g.player = { ...g.player, body: { ...g.player.body, x: 20.5 * TILE, y: 14.5 * TILE } };
    stepWorld(g, idle, NO_HOOKS);
    expect(g.lives).toBe(2);
    expect(ows(g)).toHaveLength(1);
  });

  it('knocks the player away from the enemy that hit them, whatever key is held', () => {
    const g = freshGame();
    const { x, y } = g.player.body;
    // The enemy is just left of the player, who is running into it.
    g.enemies = [{ x: x - 10, y, vx: 0, alive: true, phase: 0 }];
    const run = { ...idle, left: true };
    stepWorld(g, run, NO_HOOKS);
    expect(g.lives).toBe(2);
    for (let i = 0; i < 10; i++) stepWorld(g, run, NO_HOOKS);
    expect(g.player.body.x).toBeGreaterThan(x);
  });

  it('bounces the player clear of spikes with jump released', () => {
    const g = freshGame();
    g.player = { ...g.player, body: { ...g.player.body, x: 20.5 * TILE, y: 14.5 * TILE } };
    const start = g.player.body.y;
    let top = start;
    for (let i = 0; i < 30; i++) {
      stepWorld(g, idle, NO_HOOKS);
      top = Math.min(top, g.player.body.y);
    }
    // -300 against gravity 1800 rises 25 units; clipped to the jump cut it would rise 5.
    expect(start - top).toBeGreaterThan(20);
  });

  it('says ow when the player falls out of the level', () => {
    const g = freshGame();
    g.player = { ...g.player, body: { ...g.player.body, y: WORLD.heightPx + 200 } };
    stepWorld(g, idle, NO_HOOKS);
    expect(ows(g)).toHaveLength(1);
  });
});

describe('advanceWorld', () => {
  const idle = { left: false, right: false, jumpHeld: false, jumpPressed: false };

  it('stops stepping at the step that decides the run', () => {
    const g = freshGame();
    g.lives = 1;
    const { x, y } = g.player.body;
    g.enemies = [{ x, y, vx: 0, alive: true, phase: 0 }];
    // A coin the player would reach a few steps after the hit.
    g.coins = [{ x, y: y - 20, taken: false }];
    const elapsed = g.elapsed;
    advanceWorld(g, 0.1, () => idle, NO_HOOKS);
    expect(g.outcome).toBe('lost');
    expect(g.elapsed).toBeCloseTo(elapsed + STEP, 9);
    expect(g.score).toBe(0);
    expect(g.lives).toBe(0);
  });
});
