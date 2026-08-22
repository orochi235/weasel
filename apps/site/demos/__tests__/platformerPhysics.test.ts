// apps/site/demos/__tests__/platformerPhysics.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, TILE } from '../platformer/level';
import { STEP, createBodyState, stepBody, type Input } from '../platformer/physics';

const FLAT = parseLevel([
  '.....',
  '.....',
  '.....',
  '#####',
]);

const IDLE: Input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

/** Run `n` fixed steps and return the final state. */
function run(state = createBodyState(FLAT.spawn ?? { x: 2 * TILE, y: 0 }), input = IDLE, n = 120) {
  let s = state;
  for (let i = 0; i < n; i++) s = stepBody(s, FLAT, input, STEP);
  return s;
}

describe('stepBody gravity and floor', () => {
  it('accelerates a falling body downward', () => {
    const start = createBodyState({ x: 2 * TILE, y: TILE });
    const after = stepBody(start, FLAT, IDLE, STEP);
    expect(after.body.vy).toBeGreaterThan(0);
    expect(after.body.y).toBeGreaterThan(start.body.y);
  });

  it('lands on the floor and stops falling', () => {
    const s = run(createBodyState({ x: 2 * TILE, y: TILE }));
    expect(s.body.onGround).toBe(true);
    expect(s.body.vy).toBe(0);
    // The floor is row 3, so its top edge is at 3 * TILE; the body rests on it.
    expect(s.body.y + s.body.h / 2).toBeCloseTo(3 * TILE, 3);
  });

  it('reports the landing frame exactly once', () => {
    let s = createBodyState({ x: 2 * TILE, y: TILE });
    let landings = 0;
    for (let i = 0; i < 240; i++) {
      s = stepBody(s, FLAT, IDLE, STEP);
      if (s.landed) landings++;
    }
    expect(landings).toBe(1);
  });

  it('caps fall speed', () => {
    let s = createBodyState({ x: 2 * TILE, y: -400 * TILE });
    for (let i = 0; i < 600; i++) s = stepBody(s, FLAT, IDLE, STEP);
    expect(s.body.vy).toBeLessThanOrEqual(900);
  });
});
