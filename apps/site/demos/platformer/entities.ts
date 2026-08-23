// apps/site/demos/platformer/entities.ts
import { SOLID, TILE, tileAt, toCol, toRow, type Level, type Vec2 } from './level';
import type { Body } from './physics';

export const ENEMY_W = 18;
export const ENEMY_H = 16;
export const ENEMY_SPEED = 40;
export const COIN_R = 6;
/** Seconds of invulnerability granted by a hit. */
export const INVULN = 1.2;

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  alive: boolean;
  /** Seconds, for the shared waddle cycle's per-enemy offset. */
  phase: number;
}

export interface Coin {
  x: number;
  y: number;
  taken: boolean;
}

export type Contact =
  | { kind: 'stomp'; index: number }
  | { kind: 'hurt'; index: number }
  | { kind: 'coin'; index: number };

export const createEnemies = (at: Vec2[]): Enemy[] =>
  at.map((p, i) => ({ x: p.x, y: p.y, vx: i % 2 === 0 ? ENEMY_SPEED : -ENEMY_SPEED, alive: true, phase: i * 0.37 }));

export const createCoins = (at: Vec2[]): Coin[] => at.map((p) => ({ x: p.x, y: p.y, taken: false }));

/**
 * Walkers reverse at a wall and at a ledge. The ledge probe looks at the tile
 * *below and ahead*: no floor there means the next step walks off, so turn now.
 */
export function stepEnemy(e: Enemy, level: Level, dt: number): Enemy {
  const nextX = e.x + e.vx * dt;
  const ahead = e.vx > 0 ? nextX + ENEMY_W / 2 : nextX - ENEMY_W / 2;
  const wall = tileAt(level, toCol(ahead), toRow(e.y)) === SOLID;
  const floorAhead = tileAt(level, toCol(ahead), toRow(e.y) + 1) === SOLID;
  if (wall || !floorAhead) {
    return { ...e, vx: -e.vx, phase: e.phase + dt };
  }
  return { ...e, x: nextX, phase: e.phase + dt };
}

const overlaps = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;

/**
 * A descending player whose feet are in the enemy's upper band stomps it;
 * anything else is a hurt, which invulnerability suppresses. Coins are taken
 * regardless.
 */
export function resolveContacts(body: Body, enemies: Enemy[], coins: Coin[], invuln: number): Contact[] {
  const out: Contact[] = [];
  enemies.forEach((e, index) => {
    if (!e.alive) return;
    if (!overlaps(body.x, body.y, body.w, body.h, e.x, e.y, ENEMY_W, ENEMY_H)) return;
    const feet = body.y + body.h / 2;
    if (body.vy > 0 && feet < e.y) out.push({ kind: 'stomp', index });
    else if (invuln <= 0) out.push({ kind: 'hurt', index });
  });
  coins.forEach((c, index) => {
    if (c.taken) return;
    if (overlaps(body.x, body.y, body.w, body.h, c.x, c.y, COIN_R * 2, COIN_R * 2)) {
      out.push({ kind: 'coin', index });
    }
  });
  return out;
}

/** True when the player's box covers the goal tile's center. */
export const atGoal = (body: Body, goal: Vec2): boolean =>
  overlaps(body.x, body.y, body.w, body.h, goal.x, goal.y, TILE, TILE);
