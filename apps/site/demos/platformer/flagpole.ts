// apps/site/demos/platformer/flagpole.ts
import { TILE, type Vec2 } from './level';
import { BODY_H, BODY_W, type Body } from './physics';

/** Pole height above its base, in tiles. */
const POLE_TILES = 6;
/** How far off centre the player can be and still catch it. */
const GRAB_SLOP = TILE * 0.55;
/** World units per second the player slides down. */
export const SLIDE_SPEED = 90;
/** The flag hangs this far below the ball on top. */
export const FLAG_DROP = TILE * 0.5;
export const POLE_WIDTH = 3;
export const BALL_R = 5;

export interface Flagpole {
  x: number;
  /** Top of the pole — the ball sits here. */
  topY: number;
  /** Ground level, where the slide ends. */
  baseY: number;
}

/** The `G` tile marks the foot of the pole; it rises from there. */
export const flagpoleAt = (goal: Vec2): Flagpole => ({
  x: goal.x,
  baseY: goal.y + TILE / 2,
  topY: goal.y + TILE / 2 - TILE * POLE_TILES,
});

/**
 * True once the player's box straddles the pole anywhere along its length.
 * Deliberately generous horizontally — missing a flagpole you clearly jumped
 * at reads as a bug, not as difficulty.
 */
export function grabsPole(body: Body, pole: Flagpole): boolean {
  if (Math.abs(body.x - pole.x) > GRAB_SLOP + BODY_W / 2) return false;
  const feet = body.y + BODY_H / 2;
  const head = body.y - BODY_H / 2;
  return feet >= pole.topY && head <= pole.baseY;
}

/** Where the flag sits while the player is at `y` — it rides down with them. */
export function flagY(pole: Flagpole, playerY: number | null): number {
  const top = pole.topY + FLAG_DROP;
  if (playerY === null) return top;
  return Math.min(Math.max(playerY, top), pole.baseY - FLAG_DROP);
}
