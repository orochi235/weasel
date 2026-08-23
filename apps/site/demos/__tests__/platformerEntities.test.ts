// apps/site/demos/__tests__/platformerEntities.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, TILE } from '../platformer/level';
import { createBodyState } from '../platformer/physics';
import {
  ENEMY_H, ENEMY_W, createCoins, createEnemies, resolveContacts, stepEnemy,
} from '../platformer/entities';

const LEDGE = parseLevel([
  '.......',
  '.......',
  '.#####.',
  '.......',
]);

describe('stepEnemy', () => {
  it('walks along its platform', () => {
    let e = createEnemies([{ x: 3.5 * TILE, y: 1.5 * TILE }])[0];
    const startX = e.x;
    for (let i = 0; i < 30; i++) e = stepEnemy(e, LEDGE, 1 / 60);
    expect(e.x).not.toBeCloseTo(startX, 3);
  });

  it('turns around at a ledge rather than walking off', () => {
    let e = createEnemies([{ x: 5 * TILE, y: 1.5 * TILE }])[0];
    e = { ...e, vx: 40 };
    for (let i = 0; i < 600; i++) {
      e = stepEnemy(e, LEDGE, 1 / 60);
      expect(e.x).toBeGreaterThan(1 * TILE - 1);
      expect(e.x).toBeLessThan(6 * TILE + 1);
    }
  });

  it('turns around at a wall', () => {
    const BOXED = parseLevel(['.....', '#...#', '#####']);
    let e = createEnemies([{ x: 2.5 * TILE, y: 1.5 * TILE }])[0];
    e = { ...e, vx: 40 };
    let reversed = false;
    for (let i = 0; i < 600; i++) {
      const before = Math.sign(e.vx);
      e = stepEnemy(e, BOXED, 1 / 60);
      if (Math.sign(e.vx) !== before) reversed = true;
    }
    expect(reversed).toBe(true);
  });

  it('advances its animation phase', () => {
    let e = createEnemies([{ x: 3.5 * TILE, y: 1.5 * TILE }])[0];
    const start = e.phase;
    e = stepEnemy(e, LEDGE, 1 / 60);
    expect(e.phase).toBeGreaterThan(start);
  });
});

describe('resolveContacts', () => {
  const at = (x: number, y: number) => createBodyState({ x, y }).body;

  it('reports a coin the player overlaps, once', () => {
    const coins = createCoins([{ x: 100, y: 100 }]);
    const hits = resolveContacts(at(100, 100), [], coins, 0);
    expect(hits).toEqual([{ kind: 'coin', index: 0 }]);
    coins[0].taken = true;
    expect(resolveContacts(at(100, 100), [], coins, 0)).toEqual([]);
  });

  it('reads a descending player above an enemy as a stomp', () => {
    const enemies = createEnemies([{ x: 100, y: 100 }]);
    const body = { ...at(100, 100 - ENEMY_H / 2 - 6), vy: 200 };
    expect(resolveContacts(body, enemies, [], 0)).toEqual([{ kind: 'stomp', index: 0 }]);
  });

  it('reads a side collision as a hurt', () => {
    const enemies = createEnemies([{ x: 100, y: 100 }]);
    const body = { ...at(100 - ENEMY_W / 2 - 2, 100), vy: 0 };
    expect(resolveContacts(body, enemies, [], 0)).toEqual([{ kind: 'hurt', index: 0 }]);
  });

  it('suppresses hurt while the player is invulnerable but still takes coins', () => {
    const enemies = createEnemies([{ x: 100, y: 100 }]);
    const coins = createCoins([{ x: 100, y: 100 }]);
    const body = { ...at(100 - ENEMY_W / 2 - 2, 100), vy: 0 };
    expect(resolveContacts(body, enemies, coins, 0.5)).toEqual([{ kind: 'coin', index: 0 }]);
  });

  it('ignores a dead enemy', () => {
    const enemies = createEnemies([{ x: 100, y: 100 }]);
    enemies[0].alive = false;
    expect(resolveContacts({ ...at(100, 100), vy: 0 }, enemies, [], 0)).toEqual([]);
  });
});
