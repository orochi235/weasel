// apps/site/demos/__tests__/platformerPhysics.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, TILE } from '../platformer/level';
import { COYOTE, JUMP_BUFFER, STEP, createBodyState, spikeOverlap, stepBody, type BodyState, type Input } from '../platformer/physics';

const FLAT = parseLevel([
  '.....',
  '.....',
  '.....',
  '#####',
]);

const IDLE: Input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

/** Run `n` fixed steps and return the final state. */
function run(state: BodyState, input = IDLE, n = 120) {
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

const WALLS = parseLevel([
  '.......',
  '.......',
  '..###..',
  '.......',
  '.#...#.',
  '.#...#.',
  '#######',
]);

const RIGHT: Input = { left: false, right: true, jumpHeld: false, jumpPressed: false };
const JUMP: Input = { left: false, right: false, jumpHeld: true, jumpPressed: true };

function settle(level = WALLS, at = { x: 3 * TILE, y: 3 * TILE }) {
  let s = createBodyState(at);
  for (let i = 0; i < 240; i++) s = stepBody(s, level, IDLE, STEP);
  return s;
}

describe('stepBody walls', () => {
  it('stops at a wall instead of passing through it', () => {
    let s = settle();
    for (let i = 0; i < 240; i++) s = stepBody(s, WALLS, RIGHT, STEP);
    // The wall column is 5, so its left face is at 5 * TILE.
    expect(s.body.x + s.body.w / 2).toBeCloseTo(5 * TILE, 3);
  });

  it('stops rising at a ceiling', () => {
    let s = createBodyState({ x: 3 * TILE, y: 5 * TILE });
    for (let i = 0; i < 240; i++) s = stepBody(s, WALLS, IDLE, STEP);
    for (let i = 0; i < 120; i++) s = stepBody(s, WALLS, JUMP, STEP);
    expect(s.body.y - s.body.h / 2).toBeGreaterThanOrEqual(3 * TILE - 0.01);
  });
});

describe('one-way platforms', () => {
  const ONEWAY_LEVEL = parseLevel([
    '.....',
    '.....',
    '.....',
    '.===.',
    '.....',
    '#####',
  ]);

  it('catches a body falling onto it', () => {
    let s = createBodyState({ x: 2 * TILE, y: 0 });
    for (let i = 0; i < 240; i++) s = stepBody(s, ONEWAY_LEVEL, IDLE, STEP);
    expect(s.body.onGround).toBe(true);
    expect(s.body.y + s.body.h / 2).toBeCloseTo(3 * TILE, 3);
  });

  it('lets a body jump up through it', () => {
    // Start resting on the floor below the platform.
    let s = createBodyState({ x: 2 * TILE, y: 4.5 * TILE });
    for (let i = 0; i < 120; i++) s = stepBody(s, ONEWAY_LEVEL, IDLE, STEP);
    expect(s.body.y + s.body.h / 2).toBeCloseTo(5 * TILE, 3);
    let minTop = Infinity;
    s = stepBody(s, ONEWAY_LEVEL, JUMP, STEP);
    for (let i = 0; i < 60; i++) {
      s = stepBody(s, ONEWAY_LEVEL, { ...JUMP, jumpPressed: false }, STEP);
      minTop = Math.min(minTop, s.body.y - s.body.h / 2);
    }
    // It got above the platform's top rather than being stopped under it.
    expect(minTop).toBeLessThan(3 * TILE);
  });
});

describe('jump feel', () => {
  it('allows a jump shortly after walking off a ledge', () => {
    const LEDGE = parseLevel(['.....', '.....', '.....', '##...', '.....']);
    let s = createBodyState({ x: 1.5 * TILE, y: 2 * TILE });
    for (let i = 0; i < 120; i++) s = stepBody(s, LEDGE, IDLE, STEP);
    expect(s.body.onGround).toBe(true);
    let steps = 0;
    while (s.body.onGround && steps < 60) {
      s = stepBody(s, LEDGE, RIGHT, STEP);
      steps++;
    }
    expect(s.body.onGround).toBe(false);
    expect(s.coyote).toBeGreaterThan(0);
    s = stepBody(s, LEDGE, { ...RIGHT, jumpHeld: true, jumpPressed: true }, STEP);
    expect(s.jumped).toBe(true);
    expect(s.body.vy).toBeLessThan(0);
  });

  it('stands on a ledge edge instead of sliding off it', () => {
    const LEDGE = parseLevel(['.....', '.....', '.....', '###..']);
    // Overhangs the edge by 5 of its 14px width — normal play on 24px tiles.
    let s = createBodyState({ x: 3 * TILE - 2, y: 2 * TILE });
    for (let i = 0; i < 200; i++) s = stepBody(s, LEDGE, IDLE, STEP);
    expect(s.body.onGround).toBe(true);
  });

  it('refuses a jump once coyote time has fully decayed', () => {
    const LEDGE = parseLevel(['.....', '.....', '.....', '##...', '.....']);
    let s = createBodyState({ x: 1.5 * TILE, y: 2 * TILE });
    for (let i = 0; i < 120; i++) s = stepBody(s, LEDGE, IDLE, STEP);
    let steps = 0;
    while (s.body.onGround && steps < 60) {
      s = stepBody(s, LEDGE, RIGHT, STEP);
      steps++;
    }
    expect(s.body.onGround).toBe(false);
    for (let i = 0; i < Math.ceil(COYOTE / STEP) + 2; i++) s = stepBody(s, LEDGE, IDLE, STEP);
    expect(s.coyote).toBe(0);
    s = stepBody(s, LEDGE, { left: false, right: false, jumpHeld: true, jumpPressed: true }, STEP);
    expect(s.jumped).toBe(false);
    expect(s.body.vy).toBeGreaterThanOrEqual(0);
  });

  it('drops a buffered jump once the buffer window has fully elapsed', () => {
    let s = createBodyState({ x: 2 * TILE, y: -30 * TILE });
    s = stepBody(s, FLAT, { left: false, right: false, jumpHeld: false, jumpPressed: true }, STEP);
    for (let i = 0; i < Math.ceil(JUMP_BUFFER / STEP) + 2; i++) s = stepBody(s, FLAT, IDLE, STEP);
    expect(s.jumpBuffer).toBe(0);
    let landedWithJump = false;
    let steps = 0;
    while (!s.body.onGround && steps < 1000) {
      s = stepBody(s, FLAT, IDLE, STEP);
      if (s.landed && s.jumped) landedWithJump = true;
      steps++;
    }
    expect(s.body.onGround).toBe(true);
    expect(landedWithJump).toBe(false);
  });

  it('buffers a jump pressed just before landing', () => {
    // Column 0 clears WALLS' overhang (cols 2-4 at row 2) and pillars (cols 1
    // and 5 at rows 4-5), so this falls straight to the row-6 floor.
    let s = createBodyState({ x: 0.5 * TILE, y: 0 });
    // Fall until one step above the floor, pressing jump early.
    let pressed = false;
    let jumpedAfterLanding = false;
    for (let i = 0; i < 240; i++) {
      const airborneAndClose = !s.body.onGround && s.body.vy > 0 && s.body.y > 4.5 * TILE;
      const input: Input =
        airborneAndClose && !pressed
          ? (pressed = true, { left: false, right: false, jumpHeld: true, jumpPressed: true })
          : { left: false, right: false, jumpHeld: pressed, jumpPressed: false };
      s = stepBody(s, WALLS, input, STEP);
      if (s.jumped && pressed) jumpedAfterLanding = true;
    }
    expect(pressed).toBe(true);
    expect(jumpedAfterLanding).toBe(true);
  });

  it('cuts the jump short when the button is released', () => {
    let tall = createBodyState({ x: 3 * TILE, y: 5 * TILE });
    for (let i = 0; i < 120; i++) tall = stepBody(tall, WALLS, IDLE, STEP);
    const held = (() => {
      let s = stepBody(tall, WALLS, JUMP, STEP);
      let min = Infinity;
      for (let i = 0; i < 90; i++) {
        s = stepBody(s, WALLS, { ...JUMP, jumpPressed: false }, STEP);
        min = Math.min(min, s.body.y);
      }
      return min;
    })();
    const tapped = (() => {
      let s = stepBody(tall, WALLS, JUMP, STEP);
      let min = Infinity;
      for (let i = 0; i < 90; i++) {
        s = stepBody(s, WALLS, IDLE, STEP);
        min = Math.min(min, s.body.y);
      }
      return min;
    })();
    expect(tapped).toBeGreaterThan(held);
  });
});

describe('spikeOverlap', () => {
  it('detects a body standing in spikes', () => {
    const SPIKY = parseLevel(['.....', '..^..', '#####']);
    const on = createBodyState({ x: 2.5 * TILE, y: 1.5 * TILE });
    const off = createBodyState({ x: 0.5 * TILE, y: 1.5 * TILE });
    expect(spikeOverlap(on.body, SPIKY)).toBe(true);
    expect(spikeOverlap(off.body, SPIKY)).toBe(false);
  });
});
