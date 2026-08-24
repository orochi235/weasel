// apps/site/demos/platformer/physics.ts
import { ONEWAY, SOLID, SPIKE, TILE, tileAt, toCol, toRow, type Level, type Vec2 } from './level';

/** Fixed simulation step, in seconds. The render loop accumulates into it. */
export const STEP = 1 / 120;

export const GRAVITY = 1800;
export const MAX_FALL = 900;
export const MOVE_SPEED = 170;
export const JUMP_SPEED = 470;
/** Releasing jump mid-rise clips upward velocity to this, giving variable height. */
export const JUMP_CUT = 140;
/** Seconds after walking off a ledge during which a jump still works. */
export const COYOTE = 0.09;
/** Seconds a jump press is remembered while airborne. */
export const JUMP_BUFFER = 0.12;

export const BODY_W = 14;
export const BODY_H = 22;

export interface Body {
  /** Center x. */
  x: number;
  /** Center y. */
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  /** Last non-zero horizontal facing: 1 right, -1 left. */
  facing: 1 | -1;
}

export interface Input {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
}

export interface BodyState {
  body: Body;
  coyote: number;
  jumpBuffer: number;
  /** True only on the step a jump launched. */
  jumped: boolean;
  /** True only on the step the body touched down. */
  landed: boolean;
}

export function createBodyState(at: Vec2): BodyState {
  return {
    body: { x: at.x, y: at.y, vx: 0, vy: 0, w: BODY_W, h: BODY_H, onGround: false, facing: 1 },
    coyote: 0,
    jumpBuffer: 0,
    jumped: false,
    landed: false,
  };
}

const left = (b: Body) => b.x - b.w / 2;
const right = (b: Body) => b.x + b.w / 2;
const top = (b: Body) => b.y - b.h / 2;
const bottom = (b: Body) => b.y + b.h / 2;

/** Push the body out of solid tiles along x. Mutates. */
function resolveX(b: Body, level: Level): void {
  const r0 = toRow(top(b));
  const r1 = toRow(bottom(b) - 0.001);
  for (let cy = r0; cy <= r1; cy++) {
    if (b.vx > 0) {
      const cx = toCol(right(b) - 0.001);
      if (tileAt(level, cx, cy) === SOLID) {
        b.x = cx * TILE - b.w / 2;
        b.vx = 0;
        break;
      }
    } else if (b.vx < 0) {
      const cx = toCol(left(b));
      if (tileAt(level, cx, cy) === SOLID) {
        b.x = (cx + 1) * TILE + b.w / 2;
        b.vx = 0;
        break;
      }
    }
  }
}

/** `prevBottom` is the body's bottom edge before the move — a one-way platform
 *  only blocks a body that was entirely above it. */
function resolveY(b: Body, level: Level, prevBottom: number): 'floor' | 'ceiling' | null {
  const c0 = toCol(left(b));
  const c1 = toCol(right(b) - 0.001);
  let hit: 'floor' | 'ceiling' | null = null;
  for (let cx = c0; cx <= c1; cx++) {
    if (b.vy > 0) {
      const cy = toRow(bottom(b) - 0.001);
      const t = tileAt(level, cx, cy);
      const blocks = t === SOLID || (t === ONEWAY && prevBottom <= cy * TILE + 0.001);
      if (blocks) {
        b.y = cy * TILE - b.h / 2;
        b.vy = 0;
        hit = 'floor';
        break;
      }
    } else if (b.vy < 0) {
      const cy = toRow(top(b));
      if (tileAt(level, cx, cy) === SOLID) {
        b.y = (cy + 1) * TILE + b.h / 2;
        b.vy = 0;
        hit = 'ceiling';
        break;
      }
    }
  }
  return hit;
}

export function stepBody(s: BodyState, level: Level, input: Input, dt: number): BodyState {
  const b: Body = { ...s.body };
  let coyote = b.onGround ? COYOTE : Math.max(0, s.coyote - dt);
  let jumpBuffer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, s.jumpBuffer - dt);
  let jumped = false;

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  b.vx = dir * MOVE_SPEED;
  if (dir !== 0) b.facing = dir > 0 ? 1 : -1;

  if (jumpBuffer > 0 && coyote > 0) {
    b.vy = -JUMP_SPEED;
    jumped = true;
    jumpBuffer = 0;
    coyote = 0;
    b.onGround = false;
  }
  if (!input.jumpHeld && b.vy < -JUMP_CUT) b.vy = -JUMP_CUT;

  b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);

  const prevBottom = bottom(b);
  b.x += b.vx * dt;
  resolveX(b, level);
  b.y += b.vy * dt;
  const hit = resolveY(b, level, prevBottom);

  const wasOnGround = s.body.onGround;
  b.onGround = hit === 'floor';

  return { body: b, coyote, jumpBuffer, jumped, landed: b.onGround && !wasOnGround };
}

export function spikeOverlap(b: Body, level: Level): boolean {
  for (let cy = toRow(top(b)); cy <= toRow(bottom(b) - 0.001); cy++) {
    for (let cx = toCol(left(b)); cx <= toCol(right(b) - 0.001); cx++) {
      if (tileAt(level, cx, cy) === SPIKE) return true;
    }
  }
  return false;
}

