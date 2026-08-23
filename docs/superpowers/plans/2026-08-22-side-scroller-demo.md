# Side-Scroller Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable platformer at `apps/site/demos/SideScrollerDemo.tsx` that puts continuous load on the animation timeline and the audio engine, and records the kit gaps it exposes.

**Architecture:** The scene graph is suppressed; every visual is a custom `RenderLayer` reading entity state out of refs. A fixed-timestep loop runs on `animator.onTick`. The player is an eleven-joint rig posed by blended `SampledTrack<Pose>` clips; a looping `animator.timeline` carries an `EventTrack` that fires footstep audio. All game logic lives in pure modules under `apps/site/demos/platformer/` and is unit-tested; the `.tsx` file is wiring only.

**Tech Stack:** React, `@weasel-js/core` (SceneCanvas, animator, timeline, rig, parallax, draw commands), `@weasel-js/audio`, vitest + jsdom.

**Worktree:** `/Users/mike/src/weasel-side-scroller` (branch `side-scroller-demo`). All paths below are relative to it.

**Spec:** `docs/superpowers/specs/2026-08-22-side-scroller-demo-design.md`

---

## File structure

Pure logic, unit-tested, under `apps/site/demos/platformer/`:

| File | Responsibility |
|---|---|
| `level.ts` | Tile constants, the level as string rows, `parseLevel`, tile queries |
| `physics.ts` | `stepBody` — gravity, per-axis AABB collision, one-way platforms, coyote time, jump buffer, spike overlap |
| `camera.ts` | `followCamera` (dead zone + smoothing + clamp), `cameraView` |
| `skeleton.ts` | `PLAYER_SKELETON` — eleven joints and their bind transforms |
| `clips.ts` | `poseInterpolate`, the five pose clips, `samplePose` |
| `animState.ts` | Clip state machine and cross-fade — `nextAnimState`, `resolvePose` |
| `entities.ts` | Enemy patrol, coin state, player↔entity contacts |
| `sfx.ts` | Pure PCM synthesis per sound, plus engine registration |
| `skin.ts` | The art seam — state in, `DrawCommand[]` out |
| `useInput.ts` | `key-held` bindings → a held-input ref, with a blur guard |

Wiring: `apps/site/demos/SideScrollerDemo.tsx`, registered in `apps/site/registry.ts`.

Tests live in `apps/site/demos/__tests__/` and run under the `kit` vitest project
(`apps/site/**/*.test.{ts,tsx}`). Run them with `npm run test:kit`.

**Run `npx tsc --noEmit` before every commit, not just the tests.** vitest does
not typecheck code it never executes, and `sfx.ts` shipped a type error behind a
green 7/7 run because its one Web Audio function is deliberately untested.

`autoExtras()` in `registry.ts` walks relative imports in the demo's raw source,
so every `platformer/*.ts` module the demo imports becomes a source tab with no
manual wiring — the same way `CurveLabDemo` picks up `./curveLab/presets`.

---

### Task 1: Level format and parsing

**Files:**
- Create: `apps/site/demos/platformer/level.ts`
- Test: `apps/site/demos/__tests__/platformerLevel.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

  it('walls the sides and leaves the top and bottom open', () => {
    const level = parseLevel(ROWS);
    expect(tileAt(level, -1, 0)).toBe(SOLID);
    expect(tileAt(level, 5, 0)).toBe(SOLID);
    expect(tileAt(level, 0, -1)).toBe(EMPTY);
    expect(tileAt(level, 0, 5)).toBe(EMPTY);
  });

  it('rejects ragged rows', () => {
    expect(() => parseLevel(['##', '#'])).toThrow(/ragged/i);
  });

  it('rejects an unknown glyph instead of silently reading it as air', () => {
    expect(() => parseLevel(['..', '.x'])).toThrow(/unknown glyph "x".*column 1.*row 1/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerLevel`
Expected: FAIL — cannot resolve `../platformer/level`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/site/demos/platformer/level.ts

/** Side length of one tile, in world units. */
export const TILE = 24;

export const EMPTY = 0;
export const SOLID = 1;
export const ONEWAY = 2;
export const SPIKE = 3;

export interface Vec2 {
  x: number;
  y: number;
}

export interface Level {
  cols: number;
  rows: number;
  /** Geometry only, row-major, `cols * rows` entries. */
  tiles: Uint8Array;
  spawn: Vec2;
  goal: Vec2;
  coins: Vec2[];
  enemies: Vec2[];
  widthPx: number;
  heightPx: number;
}

const GEOMETRY: Record<string, number> = { '#': SOLID, '=': ONEWAY, '^': SPIKE };
const ENTITIES = new Set(['S', 'G', 'o', 'e']);

/**
 * `#` solid, `=` one-way platform, `^` spike, `o` coin, `e` enemy, `S` spawn,
 * `G` goal, `.` air. Entity glyphs leave air behind in the tile grid.
 */
export function parseLevel(lines: string[]): Level {
  const cols = lines[0]?.length ?? 0;
  if (lines.some((r) => r.length !== cols)) {
    throw new Error('parseLevel: ragged rows — every row must be the same length');
  }
  const level: Level = {
    cols,
    rows: lines.length,
    tiles: new Uint8Array(cols * lines.length),
    spawn: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    coins: [],
    enemies: [],
    widthPx: cols * TILE,
    heightPx: lines.length * TILE,
  };
  const center = (cx: number, cy: number): Vec2 => ({ x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE });

  lines.forEach((row, cy) => {
    for (let cx = 0; cx < cols; cx++) {
      const ch = row[cx];
      const geom = GEOMETRY[ch];
      if (geom !== undefined) {
        level.tiles[cy * cols + cx] = geom;
        continue;
      }
      // A mistyped glyph would otherwise become air, and an 80-wide hand-authored
      // level makes that typo invisible until something falls through the floor.
      if (ch !== '.' && !ENTITIES.has(ch)) {
        throw new Error(`parseLevel: unknown glyph "${ch}" at column ${cx}, row ${cy}`);
      }
      if (ch === 'S') level.spawn = center(cx, cy);
      else if (ch === 'G') level.goal = center(cx, cy);
      else if (ch === 'o') level.coins.push(center(cx, cy));
      else if (ch === 'e') level.enemies.push(center(cx, cy));
    }
  });
  return level;
}

/**
 * The left and right edges read SOLID so a body can never walk out of the level.
 * Above and below read EMPTY: a jump near the ceiling is free, and falling off
 * the bottom must actually fall — a solid lower edge would catch the player on
 * an invisible floor and the out-of-bounds death could never fire.
 */
export function tileAt(level: Level, cx: number, cy: number): number {
  if (cy < 0 || cy >= level.rows) return EMPTY;
  if (cx < 0 || cx >= level.cols) return SOLID;
  return level.tiles[cy * level.cols + cx];
}

/** World x/y → tile column/row. */
export const toCol = (x: number): number => Math.floor(x / TILE);
export const toRow = (y: number): number => Math.floor(y / TILE);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerLevel`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/level.ts apps/site/demos/__tests__/platformerLevel.test.ts
git commit -m "add the platformer level format and parser"
```

---

### Task 2: Gravity and floor collision

**Files:**
- Create: `apps/site/demos/platformer/physics.ts`
- Test: `apps/site/demos/__tests__/platformerPhysics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerPhysics`
Expected: FAIL — cannot resolve `../platformer/physics`.

- [ ] **Step 3: Write the implementation**

```ts
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

/** `prevBottom` is the bottom edge before the move: a one-way platform blocks
 *  only a body that was already above it, which is what lets a jump pass up. */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerPhysics`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/physics.ts apps/site/demos/__tests__/platformerPhysics.test.ts
git commit -m "add gravity and floor collision to the platformer body"
```

---

### Task 3: Walls, one-way platforms, coyote time and jump buffering

**Files:**
- Modify: `apps/site/demos/__tests__/platformerPhysics.test.ts` (append a describe block)

No implementation change is expected — Task 2 wrote the whole of `physics.ts`. This
task exists to prove the parts Task 2's tests did not cover. If a test here fails,
fix `physics.ts` rather than the test.

Cover both sides of each timing window. A test that only ever presses jump
*inside* the coyote or buffer window passes even against a decay that never
decays, so each window also needs a test that lets it expire and asserts the
jump does not fire. Derive those waits from the exported `COYOTE` and
`JUMP_BUFFER` rather than from frame counts.

- [ ] **Step 1: Append the failing tests**

```ts
// append to apps/site/demos/__tests__/platformerPhysics.test.ts
import { COYOTE, JUMP_SPEED, MOVE_SPEED, spikeOverlap } from '../platformer/physics';

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
    // A body is supported while ANY part of it is over solid ground, so walk
    // until it has fully cleared the edge rather than assuming a step count.
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
    // Requiring the whole footprint to be supported drops the body through here.
    let s = createBodyState({ x: 3 * TILE - 2, y: 2 * TILE });
    for (let i = 0; i < 200; i++) s = stepBody(s, LEDGE, IDLE, STEP);
    expect(s.body.onGround).toBe(true);
  });

  it('buffers a jump pressed just before landing', () => {
    // Column 0 is clear all the way down; column 3 has the ceiling block the
    // rising tests use, which would catch a body dropped from above.
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
```

- [ ] **Step 2: Run the tests**

Run: `npm run test:kit -- platformerPhysics`
Expected: PASS, 15 tests. If any fail, the defect is in `physics.ts` — fix it
there, unless the fixture itself is wrong (a level reused from another test whose
geometry does not suit the new case).

- [ ] **Step 3: Commit**

```bash
git add apps/site/demos/__tests__/platformerPhysics.test.ts apps/site/demos/platformer/physics.ts
git commit -m "cover walls, one-way platforms and jump feel in the platformer body"
```

---

### Task 4: Camera

**Files:**
- Create: `apps/site/demos/platformer/camera.ts`
- Test: `apps/site/demos/__tests__/platformerCamera.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/site/demos/__tests__/platformerCamera.test.ts
import { describe, it, expect } from 'vitest';
import { parseLevel, TILE } from '../platformer/level';
import { CAM_SCALE, DEAD_ZONE_X, cameraView, createCamera, followCamera } from '../platformer/camera';

const DIMS = { width: 640, height: 360 };
// 40 x 20 tiles — wider and taller than the viewport in world units.
const BIG = parseLevel(Array.from({ length: 20 }, () => '.'.repeat(40)));

describe('followCamera', () => {
  it('does not move while the target is inside the dead zone', () => {
    const cam = createCamera({ x: 20 * TILE, y: 10 * TILE });
    const next = followCamera(cam, { x: 20 * TILE + 4, y: 10 * TILE }, DIMS, BIG, 1 / 60);
    expect(next.x).toBeCloseTo(cam.x, 6);
  });

  it('chases a target that leaves the dead zone', () => {
    let cam = createCamera({ x: 20 * TILE, y: 10 * TILE });
    const target = { x: 30 * TILE, y: 10 * TILE };
    for (let i = 0; i < 300; i++) cam = followCamera(cam, target, DIMS, BIG, 1 / 60);
    expect(cam.x).toBeGreaterThan(20 * TILE);
    expect(target.x - cam.x).toBeCloseTo(DEAD_ZONE_X, 6);
  });

  it('clamps so the view never leaves the level', () => {
    let cam = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 600; i++) cam = followCamera(cam, { x: -500, y: -500 }, DIMS, BIG, 1 / 60);
    const view = cameraView(cam, DIMS);
    expect(view.x).toBeGreaterThanOrEqual(-0.001);
    expect(view.y).toBeGreaterThanOrEqual(-0.001);

    let far = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 600; i++) far = followCamera(far, { x: 1e5, y: 1e5 }, DIMS, BIG, 1 / 60);
    const farView = cameraView(far, DIMS);
    expect(farView.x + DIMS.width / CAM_SCALE).toBeLessThanOrEqual(BIG.widthPx + 0.001);
    expect(farView.y + DIMS.height / CAM_SCALE).toBeLessThanOrEqual(BIG.heightPx + 0.001);
  });

  it('centers a level smaller than the viewport instead of clamping it to a corner', () => {
    const SMALL = parseLevel(Array.from({ length: 4 }, () => '.'.repeat(4)));
    let cam = createCamera({ x: 0, y: 0 });
    for (let i = 0; i < 300; i++) cam = followCamera(cam, { x: 1e4, y: 1e4 }, DIMS, SMALL, 1 / 60);
    const view = cameraView(cam, DIMS);
    expect(view.x + DIMS.width / CAM_SCALE / 2).toBeCloseTo(SMALL.widthPx / 2, 3);
    expect(view.y + DIMS.height / CAM_SCALE / 2).toBeCloseTo(SMALL.heightPx / 2, 3);
  });

  it('produces a view at the camera zoom', () => {
    const view = cameraView(createCamera({ x: 100, y: 50 }), DIMS);
    expect(view.scale).toEqual({ x: CAM_SCALE, y: CAM_SCALE });
    expect(view.x).toBeCloseTo(100 - DIMS.width / CAM_SCALE / 2, 6);
    expect(view.y).toBeCloseTo(50 - DIMS.height / CAM_SCALE / 2, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerCamera`
Expected: FAIL — cannot resolve `../platformer/camera`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/site/demos/platformer/camera.ts
import type { Dims, View } from '@weasel-js/core';
import type { Level, Vec2 } from './level';

/** World units are small (24px tiles), so the camera magnifies. */
export const CAM_SCALE = 2;
/** Half-width / half-height of the box the target moves in freely, in world units. */
export const DEAD_ZONE_X = 28;
export const DEAD_ZONE_Y = 20;
/** Exponential follow rate; higher is snappier. */
export const CAM_LAMBDA = 6;

export interface Camera {
  /** World position the viewport is centered on. */
  x: number;
  y: number;
}

export const createCamera = (at: Vec2): Camera => ({ x: at.x, y: at.y });

const approach = (from: number, to: number, dt: number): number =>
  from + (to - from) * (1 - Math.exp(-CAM_LAMBDA * dt));

/** Clamp a center so the visible span stays inside `[0, extent]`, or center it
 *  outright when the level is smaller than the span. */
function clampCenter(center: number, span: number, extent: number): number {
  if (span >= extent) return extent / 2;
  return Math.min(Math.max(center, span / 2), extent - span / 2);
}

export function followCamera(cam: Camera, target: Vec2, dims: Dims, level: Level, dt: number): Camera {
  const wantX = Math.abs(target.x - cam.x) <= DEAD_ZONE_X
    ? cam.x
    : target.x - Math.sign(target.x - cam.x) * DEAD_ZONE_X;
  const wantY = Math.abs(target.y - cam.y) <= DEAD_ZONE_Y
    ? cam.y
    : target.y - Math.sign(target.y - cam.y) * DEAD_ZONE_Y;

  const spanX = dims.width / CAM_SCALE;
  const spanY = dims.height / CAM_SCALE;
  return {
    x: clampCenter(approach(cam.x, wantX, dt), spanX, level.widthPx),
    y: clampCenter(approach(cam.y, wantY, dt), spanY, level.heightPx),
  };
}

/** The world-space origin of the screen, at the camera's zoom. */
export function cameraView(cam: Camera, dims: Dims): View {
  return {
    x: cam.x - dims.width / CAM_SCALE / 2,
    y: cam.y - dims.height / CAM_SCALE / 2,
    scale: { x: CAM_SCALE, y: CAM_SCALE },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerCamera`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/camera.ts apps/site/demos/__tests__/platformerCamera.test.ts
git commit -m "add the platformer follow camera"
```

---

### Task 5: Player skeleton and pose clips

**Files:**
- Create: `apps/site/demos/platformer/skeleton.ts`
- Create: `apps/site/demos/platformer/clips.ts`
- Test: `apps/site/demos/__tests__/platformerClips.test.ts`

Background the implementer needs: `Pose` is a map of **deltas from the bind
pose**, not absolute transforms — `resolveSkeleton` adds `x`/`y`/`rotation` onto
bind and multiplies `scaleX`/`scaleY`. An absent joint means "at bind". Joints
must be listed parent-before-child or `resolveSkeleton` throws.

- [ ] **Step 1: Write the failing test**

```ts
// apps/site/demos/__tests__/platformerClips.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSkeleton } from '@weasel-js/core';
import { BONE_LENGTH, JOINT_ORDER, PLAYER_SKELETON } from '../platformer/skeleton';
import { CLIPS, poseInterpolate, samplePose } from '../platformer/clips';

describe('PLAYER_SKELETON', () => {
  it('has eleven joints in topological order', () => {
    expect(PLAYER_SKELETON.joints).toHaveLength(11);
    const seen = new Set<string>();
    for (const j of PLAYER_SKELETON.joints) {
      if (j.parent !== null) expect(seen.has(j.parent)).toBe(true);
      seen.add(j.name);
    }
    expect(seen.size).toBe(11);
  });

  it('resolves without throwing and gives every joint a matrix', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    expect(joints.size).toBe(11);
    for (const name of JOINT_ORDER) expect(joints.get(name)).toBeInstanceOf(Float32Array);
  });

  it('gives every drawable bone a length', () => {
    for (const name of JOINT_ORDER) expect(BONE_LENGTH[name]).toBeGreaterThan(0);
  });
});

describe('poseInterpolate', () => {
  it('returns the endpoints at u = 0 and u = 1', () => {
    const a = { torso: { rotation: 0.5 } };
    const b = { torso: { rotation: -0.5 } };
    expect(poseInterpolate(a, b, 0).torso.rotation).toBeCloseTo(0.5, 6);
    expect(poseInterpolate(a, b, 1).torso.rotation).toBeCloseTo(-0.5, 6);
  });

  it('blends halfway', () => {
    const a = { torso: { rotation: 1 } };
    const b = { torso: { rotation: 0 } };
    expect(poseInterpolate(a, b, 0.5).torso.rotation).toBeCloseTo(0.5, 6);
  });
});

describe('samplePose', () => {
  it('returns a pose at any t within every clip', () => {
    for (const [name, clip] of Object.entries(CLIPS)) {
      for (const u of [0, 0.13, 0.5, 0.87, 1]) {
        const pose = samplePose(clip, u * clip.duration);
        expect(Object.keys(pose).length, `${name} at u=${u}`).toBeGreaterThan(0);
      }
    }
  });

  it('clamps out-of-range t rather than returning undefined', () => {
    const run = CLIPS.run;
    expect(samplePose(run, -500)).toEqual(samplePose(run, 0));
    expect(samplePose(run, run.duration + 500)).toEqual(samplePose(run, run.duration));
  });

  it('makes the run cycle seamless — its last key matches its first', () => {
    const run = CLIPS.run;
    const start = samplePose(run, 0);
    const end = samplePose(run, run.duration);
    for (const joint of Object.keys(start)) {
      expect(end[joint]?.rotation ?? 0, `joint ${joint}`).toBeCloseTo(start[joint]?.rotation ?? 0, 6);
    }
  });

  it('swings the legs in opposition through the run cycle', () => {
    const quarter = samplePose(CLIPS.run, CLIPS.run.duration * 0.25);
    expect(Math.sign(quarter.thighL!.rotation!)).toBe(-Math.sign(quarter.thighR!.rotation!));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerClips`
Expected: FAIL — cannot resolve `../platformer/skeleton`.

- [ ] **Step 3: Write the skeleton**

```ts
// apps/site/demos/platformer/skeleton.ts
import type { Joint, Skeleton } from '@weasel-js/core';

/**
 * Bones point along their own local +x. A joint's `bind.x` is therefore the
 * parent bone's length, which is what puts each joint at the far end of its
 * parent. y is screen-down, so -PI/2 points a bone up the screen.
 */
const j = (name: string, parent: string | null, x: number, y: number, rotation: number): Joint => ({
  name,
  parent,
  bind: { x, y, rotation, scaleX: 1, scaleY: 1 },
});

export const PLAYER_SKELETON: Skeleton = {
  joints: [
    j('hip', null, 0, 0, 0),
    j('torso', 'hip', 0, -2, -Math.PI / 2),
    j('head', 'torso', 13, 0, 0),
    j('armL', 'torso', 9, 0, 2.5),
    j('foreL', 'armL', 8, 0, 0.4),
    j('armR', 'torso', 9, 0, -2.5),
    j('foreR', 'armR', 8, 0, -0.4),
    j('thighL', 'hip', 0, 2, Math.PI / 2),
    j('shinL', 'thighL', 9, 0, 0),
    j('thighR', 'hip', 0, 2, Math.PI / 2),
    j('shinR', 'thighR', 9, 0, 0),
  ],
};

export const JOINT_ORDER = PLAYER_SKELETON.joints.map((joint) => joint.name);

/** Drawn length of the bone starting at each joint, in world units. */
export const BONE_LENGTH: Record<string, number> = {
  hip: 6,
  torso: 13,
  head: 8,
  armL: 8,
  foreL: 7,
  armR: 8,
  foreR: 7,
  thighL: 9,
  shinL: 9,
  thighR: 9,
  shinR: 9,
};

/** Drawn thickness of the bone starting at each joint, in world units. */
export const BONE_WIDTH: Record<string, number> = {
  hip: 9,
  torso: 9,
  head: 8,
  armL: 4,
  foreL: 3.5,
  armR: 4,
  foreR: 3.5,
  thighL: 5,
  shinL: 4,
  thighR: 5,
  shinR: 4,
};
```

- [ ] **Step 4: Write the clips**

```ts
// apps/site/demos/platformer/clips.ts
import { blendPoses, easeInOutSine, sampleTrack } from '@weasel-js/core';
import type { Keyframe, Pose, SampledTrack } from '@weasel-js/core';

/** Blending two poses IS interpolating between them — the rig needs no
 *  timeline integration of its own beyond this one line. */
export const poseInterpolate = (a: Pose, b: Pose, u: number): Pose => blendPoses([a, b], [1 - u, u]);

export interface Clip {
  /** Milliseconds. */
  duration: number;
  keys: Keyframe<Pose>[];
}

const clip = (duration: number, keys: Keyframe<Pose>[]): Clip => ({ duration, keys });

/** Arms and legs swung to one side; `s` flips the whole thing for the other half
 *  of the cycle, which is what makes one authored key serve both footfalls. */
const stride = (s: 1 | -1, lift: number): Pose => ({
  hip: { y: lift },
  torso: { rotation: -0.08 * s },
  thighL: { rotation: 0.5 * s },
  shinL: { rotation: s > 0 ? 0.15 : 0.7 },
  thighR: { rotation: -0.5 * s },
  shinR: { rotation: s > 0 ? 0.7 : 0.15 },
  armL: { rotation: -0.6 * s },
  foreL: { rotation: -0.3 },
  armR: { rotation: 0.6 * s },
  foreR: { rotation: 0.3 },
});

const NEUTRAL: Pose = {
  hip: { y: 0 },
  torso: { rotation: 0 },
  thighL: { rotation: 0 },
  shinL: { rotation: 0 },
  thighR: { rotation: 0 },
  shinR: { rotation: 0 },
  armL: { rotation: 0 },
  foreL: { rotation: 0 },
  armR: { rotation: 0 },
  foreR: { rotation: 0 },
};

/**
 * One full run cycle is two footfalls. The mirrored keys at 0 and half-duration
 * are the contacts; the passing poses between them carry the body's rise.
 */
export const RUN = clip(500, [
  { t: 0, value: stride(1, 0) },
  { t: 125, value: stride(1, -2), easing: easeInOutSine },
  { t: 250, value: stride(-1, 0), easing: easeInOutSine },
  { t: 375, value: stride(-1, -2), easing: easeInOutSine },
  { t: 500, value: stride(1, 0), easing: easeInOutSine },
]);

export const IDLE = clip(1600, [
  { t: 0, value: NEUTRAL },
  {
    t: 800,
    value: { ...NEUTRAL, hip: { y: 1 }, torso: { rotation: 0.04 }, armL: { rotation: 0.08 }, armR: { rotation: -0.08 } },
    easing: easeInOutSine,
  },
  { t: 1600, value: NEUTRAL, easing: easeInOutSine },
]);

/** Seeked by vertical velocity rather than played: t = 0 is the launch, t =
 *  duration is the apex. */
export const JUMP = clip(300, [
  { t: 0, value: { ...NEUTRAL, hip: { y: 2 }, thighL: { rotation: 0.7 }, shinL: { rotation: -0.9 }, thighR: { rotation: 0.5 }, shinR: { rotation: -0.6 } } },
  { t: 300, value: { ...NEUTRAL, hip: { y: -2 }, armL: { rotation: -0.9 }, armR: { rotation: 0.9 }, thighL: { rotation: -0.3 }, thighR: { rotation: 0.2 }, shinR: { rotation: 0.4 } }, easing: easeInOutSine },
]);

/** Also seeked: t = 0 at the apex, t = duration at terminal velocity. */
export const FALL = clip(300, [
  { t: 0, value: { ...NEUTRAL, armL: { rotation: -0.9 }, armR: { rotation: 0.9 }, thighL: { rotation: -0.3 }, thighR: { rotation: 0.2 } } },
  { t: 300, value: { ...NEUTRAL, armL: { rotation: -1.6 }, armR: { rotation: 1.6 }, thighL: { rotation: 0.4 }, shinL: { rotation: -0.5 }, thighR: { rotation: -0.2 } }, easing: easeInOutSine },
]);

export const HURT = clip(400, [
  { t: 0, value: { ...NEUTRAL, torso: { rotation: 0.5 }, armL: { rotation: -1.4 }, armR: { rotation: 1.4 }, hip: { y: -3 } } },
  { t: 400, value: NEUTRAL, easing: easeInOutSine },
]);

export const CLIPS = { idle: IDLE, run: RUN, jump: JUMP, fall: FALL, hurt: HURT } as const;
export type ClipName = keyof typeof CLIPS;

/** `sampleTrack` wants a whole track, and rebuilding one per call would throw
 *  away its segment cache — so each clip gets one track and one cache, made once. */
const TRACKS = new WeakMap<Clip, { track: SampledTrack<Pose>; cache: Map<number, (u: number) => Pose> }>();

function trackFor(c: Clip) {
  let entry = TRACKS.get(c);
  if (!entry) {
    entry = {
      track: { kind: 'sampled', keys: c.keys, interpolate: poseInterpolate, onTick: () => {} },
      cache: new Map(),
    };
    TRACKS.set(c, entry);
  }
  return entry;
}

/** Sample a clip at `t` milliseconds, clamped to the clip's range. */
export function samplePose(c: Clip, t: number): Pose {
  const { track, cache } = trackFor(c);
  const clamped = Math.min(Math.max(t, 0), c.duration);
  return sampleTrack(track, clamped, cache) ?? {};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:kit -- platformerClips`
Expected: PASS, 9 tests. If the seamless-cycle assertion fails, the first and
last `RUN` keys have drifted apart — make them the same `stride` call.

- [ ] **Step 6: Commit**

```bash
git add apps/site/demos/platformer/skeleton.ts apps/site/demos/platformer/clips.ts apps/site/demos/__tests__/platformerClips.test.ts
git commit -m "add the player skeleton and its five pose clips"
```

---

### Task 6: Animation state machine and cross-fade

**Files:**
- Create: `apps/site/demos/platformer/animState.ts`
- Test: `apps/site/demos/__tests__/platformerAnimState.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/site/demos/__tests__/platformerAnimState.test.ts
import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FADE_MS, createAnimState, nextAnimState, resolvePose, type AnimCtx } from '../platformer/animState';

const GROUND: AnimCtx = { onGround: true, vx: 0, vy: 0, hurt: false };
const RUNNING: AnimCtx = { onGround: true, vx: 150, vy: 0, hurt: false };
const RISING: AnimCtx = { onGround: false, vx: 0, vy: -300, hurt: false };
const FALLING: AnimCtx = { onGround: false, vx: 0, vy: 300, hurt: false };

describe('nextAnimState', () => {
  it('starts idle and stays idle while still on the ground', () => {
    let s = createAnimState();
    expect(s.current).toBe('idle');
    for (let i = 0; i < 30; i++) s = nextAnimState(s, GROUND, 1 / 60);
    expect(s.current).toBe('idle');
    expect(s.previous).toBe(null);
  });

  it('switches to run when moving and back to idle when stopped', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.current).toBe('run');
    expect(s.previous).toBe('idle');
    for (let i = 0; i < 60; i++) s = nextAnimState(s, GROUND, 1 / 60);
    expect(s.current).toBe('idle');
  });

  it('picks jump while rising and fall while descending', () => {
    let s = nextAnimState(createAnimState(), RISING, 1 / 60);
    expect(s.current).toBe('jump');
    s = nextAnimState(s, FALLING, 1 / 60);
    expect(s.current).toBe('fall');
  });

  it('lets hurt override everything', () => {
    let s = nextAnimState(createAnimState(), { ...RUNNING, hurt: true }, 1 / 60);
    expect(s.current).toBe('hurt');
  });

  it('completes the cross-fade over FADE_MS and then drops the previous clip', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    expect(s.fade).toBeLessThan(1);
    expect(s.previous).toBe('idle');
    const steps = Math.ceil(FADE_MS / 1000 / (1 / 60)) + 2;
    for (let i = 0; i < steps; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    expect(s.fade).toBe(1);
    expect(s.previous).toBe(null);
  });

  it('scales the run cycle phase with ground speed', () => {
    let slow = nextAnimState(createAnimState(), { ...RUNNING, vx: 40 }, 1 / 60);
    let fast = nextAnimState(createAnimState(), { ...RUNNING, vx: 170 }, 1 / 60);
    for (let i = 0; i < 10; i++) {
      slow = nextAnimState(slow, { ...RUNNING, vx: 40 }, 1 / 60);
      fast = nextAnimState(fast, { ...RUNNING, vx: 170 }, 1 / 60);
    }
    expect(fast.phase).toBeGreaterThan(slow.phase);
  });

  it('drives jump and fall by velocity instead of elapsed time', () => {
    const slowRise = nextAnimState(createAnimState(), { ...RISING, vy: -50 }, 1 / 60);
    const fastRise = nextAnimState(createAnimState(), { ...RISING, vy: -450 }, 1 / 60);
    // Faster rise sits nearer the launch key; slower rise nears the apex.
    expect(fastRise.phase).toBeLessThan(slowRise.phase);
  });

  it('wraps the run phase instead of growing without bound', () => {
    let s = createAnimState();
    for (let i = 0; i < 2000; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    expect(s.phase).toBeGreaterThanOrEqual(0);
    expect(s.phase).toBeLessThanOrEqual(CLIPS.run.duration);
  });
});

describe('resolvePose', () => {
  it('returns a pose with no previous clip', () => {
    const pose = resolvePose(createAnimState());
    expect(Object.keys(pose).length).toBeGreaterThan(0);
  });

  it('blends toward the new clip as the fade advances', () => {
    let s = nextAnimState(createAnimState(), RUNNING, 1 / 60);
    const early = resolvePose(s);
    for (let i = 0; i < 4; i++) s = nextAnimState(s, RUNNING, 1 / 60);
    const later = resolvePose(s);
    expect(early).not.toEqual(later);
    expect(Object.keys(later).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerAnimState`
Expected: FAIL — cannot resolve `../platformer/animState`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/site/demos/platformer/animState.ts
import { CLIPS, poseInterpolate, samplePose, type ClipName } from './clips';
import type { Pose } from '@weasel-js/core';
import { JUMP_SPEED, MAX_FALL, MOVE_SPEED } from './physics';

/** Cross-fade duration between clips, in milliseconds. */
export const FADE_MS = 120;

export interface AnimState {
  current: ClipName;
  /** The pose that was on screen when the current clip took over, frozen.
   *  A clip name cannot stand in for this: switching again mid-fade would
   *  discard whatever the earlier blend contributed and the pose would pop. */
  outgoing: Pose | null;
  /** 0 → all outgoing, 1 → all current. */
  fade: number;
  /** Playhead into `current`, in milliseconds. */
  phase: number;
}

export interface AnimCtx {
  onGround: boolean;
  vx: number;
  vy: number;
  hurt: boolean;
}

export const createAnimState = (): AnimState => ({
  current: 'idle',
  outgoing: null,
  fade: 1,
  phase: 0,
});

function pick(ctx: AnimCtx): ClipName {
  if (ctx.hurt) return 'hurt';
  if (!ctx.onGround) return ctx.vy < 0 ? 'jump' : 'fall';
  return Math.abs(ctx.vx) > 1 ? 'run' : 'idle';
}

/**
 * Airborne clips are seeked by velocity, not played: the jump clip runs from
 * launch to apex as upward speed bleeds off, and the fall clip runs from apex to
 * terminal velocity. Grounded clips advance on the clock, with the run cycle's
 * rate tied to ground speed so the feet keep up with the ground.
 */
function advance(name: ClipName, prevPhase: number, ctx: AnimCtx, dt: number): number {
  const clip = CLIPS[name];
  if (name === 'jump') {
    const u = 1 - Math.min(Math.abs(ctx.vy) / JUMP_SPEED, 1);
    return u * clip.duration;
  }
  if (name === 'fall') {
    const u = Math.min(Math.max(ctx.vy, 0) / MAX_FALL, 1);
    return u * clip.duration;
  }
  const rate = name === 'run' ? Math.max(Math.abs(ctx.vx) / MOVE_SPEED, 0.15) : 1;
  const next = prevPhase + dt * 1000 * rate;
  return name === 'run' || name === 'idle' ? next % clip.duration : Math.min(next, clip.duration);
}

export function nextAnimState(s: AnimState, ctx: AnimCtx, dt: number): AnimState {
  const want = pick(ctx);
  const switching = want !== s.current;

  // Snapshot what is actually on screen, whatever mixture produced it.
  const outgoing = switching ? resolvePose(s) : s.outgoing;
  const phase = advance(want, switching ? 0 : s.phase, ctx, dt);
  const fade = outgoing === null
    ? 1
    : Math.min((switching ? 0 : s.fade) + (dt * 1000) / FADE_MS, 1);

  return { current: want, outgoing: fade >= 1 ? null : outgoing, fade, phase };
}

/** The pose the rig is drawn at: the frozen outgoing pose blended into the
 *  clip now playing. */
export function resolvePose(s: AnimState): Pose {
  const now = samplePose(CLIPS[s.current], s.phase);
  if (s.outgoing === null || s.fade >= 1) return now;
  return poseInterpolate(s.outgoing, now, s.fade);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerAnimState`
Expected: PASS, 11 tests — including one asserting the visible pose does not jump
when a second clip switch lands during an unfinished fade. Verify that one by
reverting to a clip-name `previous` and watching it fail; a fade bug is invisible
to every other assertion.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/animState.ts apps/site/demos/__tests__/platformerAnimState.test.ts
git commit -m "cross-fade the platformer's pose clips from a velocity-driven state machine"
```

---

### Task 7: Enemies, coins and contacts

**Files:**
- Create: `apps/site/demos/platformer/entities.ts`
- Test: `apps/site/demos/__tests__/platformerEntities.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerEntities`
Expected: FAIL — cannot resolve `../platformer/entities`.

- [ ] **Step 3: Write the implementation**

```ts
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
  // Sample the row directly below, not an offset derived from ENEMY_H: enemies
  // sit row-centered with a gap under them, so a height-derived probe lands back
  // in the enemy's own empty row and it reverses every frame without moving.
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerEntities`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/entities.ts apps/site/demos/__tests__/platformerEntities.test.ts
git commit -m "add platformer enemies, coins and contact resolution"
```

---

### Task 8: Sound synthesis

**Files:**
- Create: `apps/site/demos/platformer/sfx.ts`
- Test: `apps/site/demos/__tests__/platformerSfx.test.ts`

The PCM generation is a pure function of a sample rate so it can be tested with
no `AudioContext` — jsdom has none. Only `registerSounds` touches Web Audio, and
it is exercised by the demo, not by a unit test.

- [ ] **Step 1: Write the failing test**

```ts
// apps/site/demos/__tests__/platformerSfx.test.ts
import { describe, it, expect } from 'vitest';
import { SOUND_NAMES, renderSound, type SoundName } from '../platformer/sfx';

const RATE = 44100;

describe('renderSound', () => {
  it('renders every named sound', () => {
    expect(SOUND_NAMES.length).toBeGreaterThan(0);
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.length, name).toBeGreaterThan(0);
      expect(pcm).toBeInstanceOf(Float32Array);
    }
  });

  it('stays inside the [-1, 1] range so nothing clips', () => {
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      let peak = 0;
      for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
      expect(peak, `${name} peak`).toBeLessThanOrEqual(1);
      expect(peak, `${name} is silent`).toBeGreaterThan(0.01);
    }
  });

  it('emits no NaN', () => {
    for (const name of SOUND_NAMES) {
      const pcm = renderSound(name, RATE);
      expect(pcm.some((v) => Number.isNaN(v)), name).toBe(false);
    }
  });

  it('fades every one-shot to silence so nothing clicks at the tail', () => {
    for (const name of SOUND_NAMES) {
      if (name === 'bed') continue;
      const pcm = renderSound(name, RATE);
      expect(Math.abs(pcm[pcm.length - 1]), `${name} tail`).toBeLessThan(0.02);
    }
  });

  it('makes the music bed loop seamlessly', () => {
    const pcm = renderSound('bed', RATE);
    // A seam is audible when the last sample and the first are far apart.
    expect(Math.abs(pcm[pcm.length - 1] - pcm[0])).toBeLessThan(0.05);
  });

  it('scales its length with the sample rate', () => {
    const a = renderSound('coin', 22050);
    const b = renderSound('coin', 44100);
    expect(b.length).toBeCloseTo(a.length * 2, -1);
  });

  it('rejects an unknown name', () => {
    expect(() => renderSound('nope' as SoundName, RATE)).toThrow(/unknown sound/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerSfx`
Expected: FAIL — cannot resolve `../platformer/sfx`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/site/demos/platformer/sfx.ts
import type { AudioEngine, SoundHandle } from '@weasel-js/audio';

export const SOUND_NAMES = ['step', 'jump', 'land', 'coin', 'stomp', 'hurt', 'goal', 'bed'] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

/** Deterministic noise — `Math.random` would make the tests unrepeatable. */
function noise(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s / 0x100000000) * 2 - 1;
  };
}

const env = (i: number, n: number, attack: number, release: number): number => {
  const a = Math.max(1, Math.floor(n * attack));
  const r = Math.max(1, Math.floor(n * release));
  if (i < a) return i / a;
  if (i > n - r) return Math.max(0, (n - i) / r);
  return 1;
};

/** A one-pole lowpass, for turning white noise into something footstep-shaped. */
function lowpass(buf: Float32Array, alpha: number): void {
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev += alpha * (buf[i] - prev);
    buf[i] = prev;
  }
}

function tone(n: number, rate: number, from: number, to: number, gain: number, harmonic = 0): Float32Array {
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const f = from + (to - from) * u;
    phase += (2 * Math.PI * f) / rate;
    const base = Math.sin(phase) + (harmonic ? harmonic * Math.sin(phase * 2) : 0);
    out[i] = base * gain * env(i, n, 0.01, 0.5);
  }
  return out;
}

/** One bar of a simple bass-and-bell loop, built so its last sample lands back
 *  near zero and the loop point is inaudible. */
function bed(rate: number): Float32Array {
  const n = Math.floor(rate * 4);
  const out = new Float32Array(n);
  const bassNotes = [110, 110, 146.83, 98];
  const bellNotes = [440, 587.33, 523.25, 392];
  const beat = Math.floor(n / 4);
  for (let b = 0; b < 4; b++) {
    const start = b * beat;
    for (let i = 0; i < beat; i++) {
      const t = i / rate;
      const e = env(i, beat, 0.02, 0.6);
      out[start + i] += Math.sin(2 * Math.PI * bassNotes[b] * t) * 0.18 * e;
      out[start + i] += Math.sin(2 * Math.PI * bellNotes[b] * t) * 0.06 * env(i, beat, 0.01, 0.85);
    }
  }
  // Taper the very ends into each other so the wrap is silent.
  const edge = Math.floor(rate * 0.01);
  for (let i = 0; i < edge; i++) {
    const g = i / edge;
    out[i] *= g;
    out[n - 1 - i] *= g;
  }
  return out;
}

/** Pure PCM for one sound. Mono, in [-1, 1]. */
export function renderSound(name: SoundName, rate: number): Float32Array {
  switch (name) {
    case 'step': {
      const n = Math.floor(rate * 0.07);
      const rnd = noise(0x51ed11);
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = rnd();
      lowpass(out, 0.09);
      for (let i = 0; i < n; i++) out[i] *= 0.55 * env(i, n, 0.02, 0.8);
      return out;
    }
    case 'jump':
      return tone(Math.floor(rate * 0.16), rate, 260, 660, 0.32, 0.25);
    case 'land': {
      const n = Math.floor(rate * 0.14);
      const rnd = noise(0x0dd1e5);
      const out = tone(n, rate, 180, 60, 0.3);
      const thump = new Float32Array(n);
      for (let i = 0; i < n; i++) thump[i] = rnd();
      lowpass(thump, 0.04);
      for (let i = 0; i < n; i++) out[i] = out[i] + thump[i] * 0.25 * env(i, n, 0.01, 0.9);
      return out;
    }
    case 'coin': {
      const n = Math.floor(rate * 0.22);
      const out = new Float32Array(n);
      const half = Math.floor(n / 3);
      const a = tone(half, rate, 988, 988, 0.28, 0.3);
      const b = tone(n - half, rate, 1319, 1319, 0.24, 0.3);
      out.set(a, 0);
      for (let i = 0; i < b.length; i++) out[half + i] += b[i];
      return out;
    }
    case 'stomp': {
      const n = Math.floor(rate * 0.18);
      const out = tone(n, rate, 420, 90, 0.3, 0.4);
      return out;
    }
    case 'hurt':
      return tone(Math.floor(rate * 0.3), rate, 400, 120, 0.34, 0.5);
    case 'goal': {
      const n = Math.floor(rate * 0.9);
      const out = new Float32Array(n);
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const seg = Math.floor(n / notes.length);
      notes.forEach((f, k) => {
        const part = tone(n - k * seg, rate, f, f, 0.16, 0.3);
        for (let i = 0; i < part.length; i++) out[k * seg + i] += part[i];
      });
      for (let i = 0; i < n; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
      return out;
    }
    case 'bed':
      return bed(rate);
    default:
      throw new Error(`renderSound: unknown sound "${name}"`);
  }
}

/**
 * Render every sound into the engine's context and hand back the handles.
 * Nothing is fetched — the demo ships no audio files.
 */
export function registerSounds(engine: AudioEngine): Record<SoundName, SoundHandle> {
  const rate = engine.context.sampleRate;
  const out = {} as Record<SoundName, SoundHandle>;
  for (const name of SOUND_NAMES) {
    const pcm = renderSound(name, rate);
    const buffer = engine.context.createBuffer(1, pcm.length, rate);
    // Not copyToChannel: its parameter is Float32Array<ArrayBuffer>, and an
    // unparameterized return type widens to ArrayBufferLike and is rejected.
    buffer.getChannelData(0).set(pcm);
    out[name] = engine.register(buffer);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerSfx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/sfx.ts apps/site/demos/__tests__/platformerSfx.test.ts
git commit -m "synthesize the platformer's eight sounds at load"
```

---

### Task 9: World→screen projection and the art seam

**Files:**
- Modify: `apps/site/demos/platformer/camera.ts` (add `worldToScreen`)
- Create: `apps/site/demos/platformer/skin.ts`
- Modify: `apps/site/demos/__tests__/platformerCamera.test.ts` (append)
- Test: `apps/site/demos/__tests__/platformerSkin.test.ts`

**Why every layer is screen-space.** Passing a new `view` to `SceneCanvas` each
frame means a React state update per frame. Instead the canvas view stays at
identity and every layer is `space: 'screen'`, projecting through the camera ref
itself. That is also what parallax requires — `createParallaxLayer` hands its
source layers an inner view and expects them to project — so one convention
covers both, and the whole game loop runs without touching React state.

`skin.ts` is the art seam named in the spec: state in, `DrawCommand[]` out.
Nothing else in the demo names a color or a shape, so a later sprite pass
replaces this file alone.

- [ ] **Step 1: Append the camera test**

```ts
// append to apps/site/demos/__tests__/platformerCamera.test.ts
import { worldToScreen } from '../platformer/camera';

describe('worldToScreen', () => {
  it('puts the view origin at the screen origin', () => {
    const view = cameraView(createCamera({ x: 200, y: 100 }), DIMS);
    const p = worldToScreen(view, view.x, view.y);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('scales world distance by the camera zoom', () => {
    const view = cameraView(createCamera({ x: 200, y: 100 }), DIMS);
    const a = worldToScreen(view, view.x, view.y);
    const b = worldToScreen(view, view.x + 10, view.y + 10);
    expect(b.x - a.x).toBeCloseTo(10 * CAM_SCALE, 6);
    expect(b.y - a.y).toBeCloseTo(10 * CAM_SCALE, 6);
  });

  it('inverts the documented screen→world mapping', () => {
    const view = cameraView(createCamera({ x: 512, y: 256 }), DIMS);
    const screen = worldToScreen(view, 700, 300);
    expect(screen.x / view.scale.x + view.x).toBeCloseTo(700, 4);
    expect(screen.y / view.scale.y + view.y).toBeCloseTo(300, 4);
  });
});
```

- [ ] **Step 2: Add `worldToScreen` to `camera.ts`**

```ts
// append to apps/site/demos/platformer/camera.ts

/** World point → screen pixels, the inverse of the documented
 *  `worldX = screenX / view.scale.x + view.x`. */
export function worldToScreen(view: View, wx: number, wy: number): { x: number; y: number } {
  return { x: (wx - view.x) * view.scale.x, y: (wy - view.y) * view.scale.y };
}
```

- [ ] **Step 3: Run the camera tests**

Run: `npm run test:kit -- platformerCamera`
Expected: PASS, 8 tests.

- [ ] **Step 4: Write the failing skin test**

```ts
// apps/site/demos/__tests__/platformerSkin.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSkeleton } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core';
import { cameraView, createCamera } from '../platformer/camera';
import { parseLevel, TILE } from '../platformer/level';
import { PLAYER_SKELETON } from '../platformer/skeleton';
import { createCoins, createEnemies } from '../platformer/entities';
import { drawBackdrop, drawCoins, drawEnemies, drawGoal, drawPlayer, drawTiles } from '../platformer/skin';

const DIMS = { width: 640, height: 360 };
const VIEW = cameraView(createCamera({ x: 5 * TILE, y: 3 * TILE }), DIMS);
const LEVEL = parseLevel([
  '..G..',
  '.o.e.',
  '..=..',
  'S....',
  '#^###',
]);

/** Every command in the tree, flattened through groups. */
function flatten(cmds: DrawCommand[]): DrawCommand[] {
  return cmds.flatMap((c) => (c.kind === 'group' ? [c, ...flatten(c.children)] : [c]));
}

describe('skin', () => {
  it('draws one command per visible solid tile and nothing for air', () => {
    const cmds = flatten(drawTiles(LEVEL, VIEW, DIMS));
    // 4 solid tiles, each with a cap accent because the row above is air, plus
    // one spike and one one-way.
    expect(cmds.filter((c) => c.kind === 'path').length).toBe(10);
  });

  it('culls tiles outside the view', () => {
    const wide = parseLevel([`${'#'.repeat(400)}`]);
    const all = flatten(drawTiles(wide, VIEW, DIMS)).filter((c) => c.kind === 'path').length;
    expect(all).toBeLessThan(60);
    expect(all).toBeGreaterThan(0);
  });

  it('draws a bone group for every joint', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const cmds = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    expect(flatten(cmds).filter((c) => c.kind === 'group').length).toBeGreaterThanOrEqual(11);
  });

  it('mirrors the player when facing left', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const right = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    const left = drawPlayer(joints, VIEW, { x: 100, y: 100 }, -1, false);
    expect(JSON.stringify(right)).not.toEqual(JSON.stringify(left));
  });

  it('flashes the player while invulnerable', () => {
    const joints = resolveSkeleton(PLAYER_SKELETON, {});
    const normal = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, false);
    const flashing = drawPlayer(joints, VIEW, { x: 100, y: 100 }, 1, true);
    expect(JSON.stringify(normal)).not.toEqual(JSON.stringify(flashing));
  });

  it('skips dead enemies and taken coins', () => {
    const enemies = createEnemies([{ x: 3.5 * TILE, y: 1.5 * TILE }, { x: 4.5 * TILE, y: 1.5 * TILE }]);
    enemies[1].alive = false;
    const coins = createCoins([{ x: 1.5 * TILE, y: 1.5 * TILE }, { x: 2.5 * TILE, y: 1.5 * TILE }]);
    coins[1].taken = true;
    expect(flatten(drawEnemies(enemies, VIEW)).filter((c) => c.kind === 'path').length).toBeGreaterThan(0);
    const before = flatten(drawCoins(coins, VIEW, 0)).length;
    coins[0].taken = true;
    expect(flatten(drawCoins(coins, VIEW, 0)).length).toBeLessThan(before);
  });

  it('spins a coin over its cycle', () => {
    const coins = createCoins([{ x: 1.5 * TILE, y: 1.5 * TILE }]);
    // Sample a quarter turn, not a half: the width is |cos|, so 0 and 0.5 are
    // the same edge-on width and would compare equal.
    expect(JSON.stringify(drawCoins(coins, VIEW, 0))).not.toEqual(
      JSON.stringify(drawCoins(coins, VIEW, 0.25)),
    );
  });

  it('draws every backdrop band, and only the far one paints sky', () => {
    for (const band of ['far', 'mid', 'near'] as const) {
      expect(drawBackdrop(VIEW, DIMS, band).length, band).toBeGreaterThan(0);
    }
    // Far paints the sky, but mid packs more hills into the same width from its
    // shorter period, so the counts can tie.
    expect(drawBackdrop(VIEW, DIMS, 'far').length)
      .toBeGreaterThanOrEqual(drawBackdrop(VIEW, DIMS, 'mid').length);
  });

  it('repeats hills across the whole viewport so panning never runs out', () => {
    const far = drawBackdrop(VIEW, DIMS, 'far').filter((c) => c.kind === 'path');
    expect(far.length).toBeGreaterThan(2);
  });

  it('draws a goal without throwing', () => {
    expect(drawGoal(LEVEL.goal, VIEW, 0).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm run test:kit -- platformerSkin`
Expected: FAIL — cannot resolve `../platformer/skin`.

- [ ] **Step 6: Write the implementation**

```ts
// apps/site/demos/platformer/skin.ts
import { ellipsePath, polygonFromPoints, rectPath } from '@weasel-js/core';
import type { Dims, DrawCommand, Mat3, View } from '@weasel-js/core';
import { worldToScreen } from './camera';
import { COIN_R, ENEMY_H, ENEMY_W, type Coin, type Enemy } from './entities';
import { ONEWAY, SOLID, SPIKE, TILE, tileAt, toCol, toRow, type Level, type Vec2 } from './level';
import { BONE_LENGTH, BONE_WIDTH, PLAYER_SKELETON } from './skeleton';

const COLORS = {
  sky: '#1b2536',
  far: '#2b3b55',
  mid: '#35506b',
  near: '#2a4257',
  solid: '#4a6076',
  solidTop: '#6d8aa4',
  oneway: '#8a7159',
  spike: '#c8556c',
  coin: '#f2c14e',
  enemy: '#b1594f',
  enemyEye: '#f4e6d2',
  goal: '#6fd08c',
  limb: '#e0d3c2',
  torso: '#5fa8d3',
  head: '#e8c9a8',
} as const;

const solid = (color: string) => ({ fill: 'solid' as const, color });

const rect = (x: number, y: number, w: number, h: number, color: string): DrawCommand => ({
  kind: 'path',
  path: rectPath(x, y, w, h),
  fill: solid(color),
});

export type Band = 'far' | 'mid' | 'near';

const BANDS: Record<Band, { color: string; period: number; height: number; baseline: number }> = {
  far: { color: COLORS.far, period: 420, height: 150, baseline: 210 },
  mid: { color: COLORS.mid, period: 260, height: 110, baseline: 250 },
  near: { color: COLORS.near, period: 170, height: 70, baseline: 290 },
};

/**
 * One band of hills, repeated along x so panning never runs out of scenery.
 * The parallax layer wrapping this supplies an inner view moving at the band's
 * own rate, so this function never knows how fast it is going. `far` also paints
 * the sky, since it is the bottom-most band.
 */
export function drawBackdrop(view: View, dims: Dims, band: Band): DrawCommand[] {
  const { color, period, height, baseline } = BANDS[band];
  const out: DrawCommand[] = band === 'far' ? [rect(0, 0, dims.width, dims.height, COLORS.sky)] : [];
  const horizon = worldToScreen(view, 0, baseline).y;
  const stepPx = period * view.scale.x;
  const originX = worldToScreen(view, 0, 0).x;
  const first = Math.floor(-originX / stepPx) - 1;
  const count = Math.ceil(dims.width / stepPx) + 3;
  for (let i = first; i < first + count; i++) {
    const cx = originX + i * stepPx;
    out.push({
      kind: 'path',
      path: polygonFromPoints([
        { x: cx - (period / 2) * view.scale.x, y: horizon },
        { x: cx, y: horizon - height * view.scale.y },
        { x: cx + (period / 2) * view.scale.x, y: horizon },
      ]),
      fill: solid(color),
    });
  }
  out.push(rect(0, horizon, dims.width, Math.max(0, dims.height - horizon), color));
  return out;
}

export function drawTiles(level: Level, view: View, dims: Dims): DrawCommand[] {
  const out: DrawCommand[] = [];
  const c0 = Math.max(0, toCol(view.x) - 1);
  const c1 = Math.min(level.cols - 1, toCol(view.x + dims.width / view.scale.x) + 1);
  const r0 = Math.max(0, toRow(view.y) - 1);
  const r1 = Math.min(level.rows - 1, toRow(view.y + dims.height / view.scale.y) + 1);
  const s = TILE * view.scale.x;

  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const t = tileAt(level, cx, cy);
      if (t === 0) continue;
      const p = worldToScreen(view, cx * TILE, cy * TILE);
      if (t === SOLID) {
        const capped = tileAt(level, cx, cy - 1) !== SOLID;
        out.push(rect(p.x, p.y, s, s, COLORS.solid));
        if (capped) out.push(rect(p.x, p.y, s, s * 0.16, COLORS.solidTop));
      } else if (t === ONEWAY) {
        out.push(rect(p.x, p.y, s, s * 0.22, COLORS.oneway));
      } else if (t === SPIKE) {
        out.push({
          kind: 'path',
          path: polygonFromPoints([
            { x: p.x, y: p.y + s },
            { x: p.x + s / 2, y: p.y + s * 0.15 },
            { x: p.x + s, y: p.y + s },
          ]),
          fill: solid(COLORS.spike),
        });
      }
    }
  }
  return out;
}

const boneColor = (name: string): string =>
  name === 'torso' || name === 'hip' ? COLORS.torso : name === 'head' ? COLORS.head : COLORS.limb;

/**
 * Each joint's matrix places its bone's local origin, with the bone lying along
 * local +x — so one rect per joint, wrapped in that joint's transform, draws the
 * whole figure. The outer group carries the world→screen placement and the
 * facing mirror, so the rig itself never knows which way the player looks.
 */
export function drawPlayer(
  joints: Map<string, Mat3>,
  view: View,
  at: Vec2,
  facing: 1 | -1,
  flash: boolean,
): DrawCommand[] {
  const p = worldToScreen(view, at.x, at.y);
  const k = view.scale.x * facing;
  const placement = new Float32Array(9) as Mat3;
  placement[0] = k; placement[1] = 0; placement[2] = 0;
  placement[3] = 0; placement[4] = view.scale.y; placement[5] = 0;
  placement[6] = p.x; placement[7] = p.y; placement[8] = 1;

  const children: DrawCommand[] = [];
  for (const joint of PLAYER_SKELETON.joints) {
    const m = joints.get(joint.name);
    if (!m) continue;
    const len = BONE_LENGTH[joint.name];
    const wid = BONE_WIDTH[joint.name];
    const shape: DrawCommand =
      joint.name === 'head'
        ? { kind: 'path', path: ellipsePath({ x: 0, y: -wid / 2, width: len, height: wid }), fill: solid(COLORS.head) }
        : rect(0, -wid / 2, len, wid, boneColor(joint.name));
    children.push({ kind: 'group', transform: m, children: [shape] });
  }
  return [{ kind: 'group', transform: placement, alpha: flash ? 0.45 : 1, children }];
}

export function drawEnemies(enemies: Enemy[], view: View): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (const e of enemies) {
    if (!e.alive) continue;
    // A shared waddle read at this enemy's own phase offset.
    const squash = 1 + Math.sin(e.phase * 8) * 0.12;
    const w = ENEMY_W * view.scale.x;
    const h = ENEMY_H * squash * view.scale.y;
    const p = worldToScreen(view, e.x, e.y + ENEMY_H / 2);
    out.push({
      kind: 'path',
      path: ellipsePath({ x: p.x - w / 2, y: p.y - h, width: w, height: h }),
      fill: solid(COLORS.enemy),
    });
    const eye = 2.5 * view.scale.x;
    out.push({
      kind: 'path',
      path: ellipsePath({
        x: p.x + Math.sign(e.vx) * w * 0.18 - eye / 2,
        y: p.y - h * 0.7,
        width: eye,
        height: eye,
      }),
      fill: solid(COLORS.enemyEye),
    });
  }
  return out;
}

/** `spin` is 0..1 through the coin's rotation; the ellipse narrows to a line at
 *  the quarter points, which reads as a spinning disc. */
export function drawCoins(coins: Coin[], view: View, spin: number): DrawCommand[] {
  const out: DrawCommand[] = [];
  const w = Math.abs(Math.cos(spin * Math.PI * 2));
  for (const c of coins) {
    if (c.taken) continue;
    const p = worldToScreen(view, c.x, c.y);
    const rx = Math.max(COIN_R * w, 1) * view.scale.x;
    const ry = COIN_R * view.scale.y;
    out.push({
      kind: 'path',
      path: ellipsePath({ x: p.x - rx, y: p.y - ry, width: rx * 2, height: ry * 2 }),
      fill: solid(COLORS.coin),
    });
  }
  return out;
}

export function drawGoal(goal: Vec2, view: View, pulse: number): DrawCommand[] {
  const p = worldToScreen(view, goal.x, goal.y);
  const s = TILE * view.scale.x * (0.7 + 0.1 * Math.sin(pulse * Math.PI * 2));
  return [
    {
      kind: 'path',
      path: polygonFromPoints([
        { x: p.x, y: p.y - s / 2 },
        { x: p.x + s / 2, y: p.y },
        { x: p.x, y: p.y + s / 2 },
        { x: p.x - s / 2, y: p.y },
      ]),
      fill: solid(COLORS.goal),
    },
  ];
}

export { COLORS };
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test:kit -- platformerSkin`
Expected: PASS, 10 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/site/demos/platformer/skin.ts apps/site/demos/platformer/camera.ts apps/site/demos/__tests__/platformerSkin.test.ts apps/site/demos/__tests__/platformerCamera.test.ts
git commit -m "add the platformer art seam and world-to-screen projection"
```

---

### Task 10: Held-key input

**Files:**
- Create: `apps/site/demos/platformer/useInput.ts`
- Test: `apps/site/demos/__tests__/platformerInput.test.tsx`

Background: `key-held` gives **edges**, not state — the dispatcher's held set is
private and only tracks keys a binding claimed. So the demo keeps its own set,
opened by the action's `start` and closed by the `OngoingHandle`'s `onEnd`. A key
must ride an **ongoing** invoker for this to work. The action is declared with
`useAction`, and the demo must sit under a provider that supplies the action
registry — `apps/site/main.tsx` mounts one, and `<WeaselProvider>` is the safe
wrapper for a demo that registers its own actions.

Window blur is a real gap: `keyup` never arrives if focus leaves mid-hold, so a
held direction sticks. The hook clears its own set on `blur`.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/site/demos/__tests__/platformerInput.test.tsx
import { describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { usePlatformerInput, type HeldInput } from '../platformer/useInput';

function Harness({ onReady }: { onReady: (ref: { current: HeldInput }) => void }) {
  const input = usePlatformerInput();
  onReady(input);
  return <div data-testid="harness" />;
}

function mount() {
  let ref!: { current: HeldInput };
  render(
    <WeaselProvider>
      <Harness onReady={(r) => { ref = r; }} />
    </WeaselProvider>,
  );
  return ref;
}

const key = (type: 'keydown' | 'keyup', k: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  });

describe('usePlatformerInput', () => {
  it('starts with nothing held', () => {
    const input = mount();
    expect(input.current).toEqual({ left: false, right: false, jumpHeld: false, jumpPressed: false });
  });

  it('tracks a held direction from keydown to keyup', () => {
    const input = mount();
    key('keydown', 'ArrowRight');
    expect(input.current.right).toBe(true);
    key('keyup', 'ArrowRight');
    expect(input.current.right).toBe(false);
  });

  it('accepts the WASD aliases', () => {
    const input = mount();
    key('keydown', 'a');
    expect(input.current.left).toBe(true);
    key('keyup', 'a');
    key('keydown', 'd');
    expect(input.current.right).toBe(true);
  });

  it('holds jump on space', () => {
    const input = mount();
    key('keydown', ' ');
    expect(input.current.jumpHeld).toBe(true);
    key('keyup', ' ');
    expect(input.current.jumpHeld).toBe(false);
  });

  it('clears everything on window blur so a held key cannot stick', () => {
    const input = mount();
    key('keydown', 'ArrowLeft');
    key('keydown', ' ');
    expect(input.current.left).toBe(true);
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });
    expect(input.current).toEqual({ left: false, right: false, jumpHeld: false, jumpPressed: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:kit -- platformerInput`
Expected: FAIL — cannot resolve `../platformer/useInput`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/site/demos/platformer/useInput.ts
import { useEffect, useMemo, useRef } from 'react';
import { resolveParams, useAction } from '@weasel-js/core';
import type { Action } from '@weasel-js/core';

export interface HeldInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  /** Set for exactly one simulation step after a fresh jump press; the game loop
   *  consumes it by calling `consumeJumpPress`. */
  jumpPressed: boolean;
}

type Slot = 'left' | 'right' | 'jump';

const EMPTY: HeldInput = { left: false, right: false, jumpHeld: false, jumpPressed: false };

/**
 * `key-held` is an edge API: the down opens an ongoing invocation and the up
 * closes it. The demo turns those edges back into the queryable set a character
 * controller needs, because the kit has none.
 */
export function usePlatformerInput(): { current: HeldInput } {
  const held = useRef<HeldInput>({ ...EMPTY });

  const action = useMemo<Action>(
    () => ({
      id: 'platformer.hold',
      label: 'Platformer movement',
      scope: 'hotkey',
      defaultBinding: [
        { spec: { kind: 'key-held', key: ['ArrowLeft', 'a'] }, opts: { params: { slot: 'left' } } },
        { spec: { kind: 'key-held', key: ['ArrowRight', 'd'] }, opts: { params: { slot: 'right' } } },
        { spec: { kind: 'key-held', key: [' ', 'w', 'ArrowUp'] }, opts: { params: { slot: 'jump' } } },
      ],
      invoker: {
        timing: 'ongoing',
        start: (_ctx, opts) => {
          const slot = resolveParams(opts?.params)?.slot as Slot | undefined;
          if (slot === 'jump') {
            if (!held.current.jumpHeld) held.current.jumpPressed = true;
            held.current.jumpHeld = true;
          } else if (slot) {
            held.current[slot] = true;
          }
          return {
            onEnd: () => {
              if (slot === 'jump') held.current.jumpHeld = false;
              else if (slot) held.current[slot] = false;
            },
          };
        },
      },
    }),
    [],
  );

  useAction(action);

  // Losing focus mid-hold means the keyup never arrives and the direction sticks.
  useEffect(() => {
    const clear = () => {
      held.current = { ...EMPTY };
    };
    window.addEventListener('blur', clear);
    return () => window.removeEventListener('blur', clear);
  }, []);

  return held;
}

/** Read the one-step jump edge and clear it. */
export function consumeJumpPress(input: { current: HeldInput }): boolean {
  const pressed = input.current.jumpPressed;
  input.current.jumpPressed = false;
  return pressed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:kit -- platformerInput`
Expected: PASS, 5 tests.

If the held flags never flip, the action is not reaching the dispatcher. Check
in this order: the component is under a provider that supplies the action
registry; `scope: 'hotkey'` is set; the invoker is `timing: 'ongoing'`. A hook
that calls `useAction` above the provider registers into nothing and fails
silently.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/platformer/useInput.ts apps/site/demos/__tests__/platformerInput.test.tsx
git commit -m "derive a held-key set from the platformer's key-held edges"
```

---

### Task 11: The level, and the demo shell that renders it

**Files:**
- Create: `apps/site/demos/platformer/worldLevel.ts`
- Create: `apps/site/demos/SideScrollerDemo.tsx`
- Test: `apps/site/demos/__tests__/platformerWorld.test.ts`
- Test: `apps/site/demos/__tests__/SideScrollerDemo.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
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
```

```tsx
// apps/site/demos/__tests__/SideScrollerDemo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SideScrollerDemo } from '../SideScrollerDemo';

describe('SideScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SideScrollerDemo />);
    expect(screen.getByRole('button', { name: /enable audio|restart/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:kit -- platformerWorld SideScrollerDemo`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Write the level**

Every row is exactly 80 characters. `#` solid, `=` one-way, `^` spike, `o` coin,
`e` enemy, `S` spawn, `G` goal.

```ts
// apps/site/demos/platformer/worldLevel.ts
import { parseLevel } from './level';

const ROWS = [
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '................................................................................',
  '.......................................................................G........',
  '.................................................................######.........',
  '........................o..................................o....................',
  '.......................####..........................######.....................',
  '.............o..................................o....................o..........',
  '............===..............................===.............===................',
  '.....o.................................o.............................o..........',
  '..S...................................e..............^^.e...............e.......',
  '###############.....########################...####################..###########',
];

export const WORLD = parseLevel(ROWS);
export { ROWS as WORLD_ROWS };
```

**Verify the row widths before running anything else** — a ragged row throws at
import and the failure reads as a broken demo rather than a typo:

```bash
node -e "const r=require('fs').readFileSync('apps/site/demos/platformer/worldLevel.ts','utf8').match(/'[.#=^oeSG]{2,}'/g)||[];console.log(r.length, [...new Set(r.map(s=>s.length-2))])"
```
Expected: `16 [ 80 ]`

- [ ] **Step 4: Write the demo shell**

```tsx
// apps/site/demos/SideScrollerDemo.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, WeaselProvider, createParallaxLayer, useAnimator, useScene } from '@weasel-js/core';
import type { Dims, DrawCommand, RenderLayer, View } from '@weasel-js/core';
import { CAM_SCALE, cameraView, createCamera, followCamera, type Camera } from './platformer/camera';
import { WORLD } from './platformer/worldLevel';
import { drawBackdrop, drawTiles } from './platformer/skin';

const W = 720;
const H = 405;
const DIMS: Dims = { width: W, height: H };
/** The canvas view never moves — every layer projects through the camera ref
 *  itself, which keeps the whole game loop out of React state. */
const IDENTITY_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

interface GameRefs {
  camera: Camera;
}

export function SideScrollerDemo() {
  const animator = useAnimator();
  const scene = useScene({ items: [] });
  const game = useRef<GameRefs>({ camera: createCamera(WORLD.spawn) });
  const [running, setRunning] = useState(true);

  const layers = useMemo(() => {
    const view = () => cameraView(game.current.camera, DIMS);

    // Three bands at three rates. `pan: 1` would be no parallax at all, so the
    // far hills at 0.2 crawl and the near ones at 0.7 nearly keep up.
    const bands = ([
      ['far', 0.2],
      ['mid', 0.45],
      ['near', 0.7],
    ] as const).map(([band, pan]) =>
      createParallaxLayer({
        id: `backdrop-${band}`,
        label: `Backdrop ${band}`,
        pan: { x: pan, y: pan * 0.6 },
        source: [
          {
            id: `backdrop-${band}-source`,
            label: `Backdrop ${band}`,
            space: 'screen',
            draw: (_d: unknown, inner: View, dims: Dims) => drawBackdrop(inner, dims, band),
          } as RenderLayer<unknown>,
        ],
      }),
    );

    const tiles: RenderLayer<unknown> = {
      id: 'tiles',
      label: 'Tiles',
      space: 'screen',
      draw: (_d, _v, dims): DrawCommand[] => drawTiles(WORLD, view(), dims),
    };

    return { bands, tiles };
  }, []);

  // A camera with nothing to follow still has to run, or the first frame after
  // the player lands snaps instead of easing.
  useEffect(() => animator.keepAlive(), [animator]);

  useEffect(() => {
    let last = performance.now();
    return animator.onTick(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!running) return;
      game.current.camera = followCamera(game.current.camera, WORLD.spawn, DIMS, WORLD, dt);
    });
  }, [animator, running]);

  return (
    <WeaselProvider>
      <div className="ckd-demo">
        <div className="ckd-toolbar">
          <button className="ckd-btn" onClick={() => setRunning((r) => !r)}>
            {running ? 'pause' : 'restart'}
          </button>
          <span className="ckd-readout">zoom {CAM_SCALE}x</span>
        </div>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selectionMode="none"
          animator={animator}
          view={IDENTITY_VIEW}
          layers={{
            backdropFar: { layer: layers.bands[0], before: 'scene' },
            backdropMid: { layer: layers.bands[1], after: 'backdropFar' },
            backdropNear: { layer: layers.bands[2], after: 'backdropMid' },
            tiles: { layer: layers.tiles, after: 'backdropNear' },
            scene: { drawOne: () => [] },
            selectionOverlay: null,
          }}
        />
        <div className="ckd-hint">
          A platformer built as a load test for the animation timeline and the audio
          engine. Everything is drawn by custom render layers; the scene graph is off.
        </div>
      </div>
    </WeaselProvider>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:kit -- platformerWorld SideScrollerDemo`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/site/demos/platformer/worldLevel.ts apps/site/demos/SideScrollerDemo.tsx apps/site/demos/__tests__/platformerWorld.test.ts apps/site/demos/__tests__/SideScrollerDemo.test.tsx
git commit -m "render the platformer level behind a follow camera"
```

---

### Task 12: The player

**Files:**
- Modify: `apps/site/demos/SideScrollerDemo.tsx`

- [ ] **Step 1: Extend the mount test**

```tsx
// append to apps/site/demos/__tests__/SideScrollerDemo.test.tsx
import { act } from '@testing-library/react';

it('runs simulation steps without throwing', async () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<SideScrollerDemo />);
  // Let a few animation frames drive the loop.
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
  }
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
```

- [ ] **Step 2: Run it and watch it pass trivially**

Run: `npm run test:kit -- SideScrollerDemo`
Expected: PASS. It guards the next steps rather than driving them.

- [ ] **Step 3: Add the player to the demo**

Replace the imports, `GameRefs`, the layer memo and the tick effect in
`SideScrollerDemo.tsx` with these. Everything else in the file stays.

```tsx
import { resolveSkeleton } from '@weasel-js/core';
import { createBodyState, spikeOverlap, stepBody, STEP, type BodyState, type Input } from './platformer/physics';
import { createAnimState, nextAnimState, resolvePose, type AnimState } from './platformer/animState';
import { INVULN } from './platformer/entities';
import { PLAYER_SKELETON } from './platformer/skeleton';
import { drawPlayer } from './platformer/skin';
import { consumeJumpPress, usePlatformerInput } from './platformer/useInput';

interface GameRefs {
  camera: Camera;
  player: BodyState;
  anim: AnimState;
  /** Seconds of remaining invulnerability. */
  invuln: number;
  /** Accumulated real time not yet consumed by a fixed step. */
  accumulator: number;
}

const freshGame = (): GameRefs => ({
  camera: createCamera(WORLD.spawn),
  player: createBodyState(WORLD.spawn),
  anim: createAnimState(),
  invuln: 0,
  accumulator: 0,
});
```

The hook body gains the input ref, and the layer memo gains a player layer:

```tsx
  const input = usePlatformerInput();
  const game = useRef<GameRefs>(freshGame());
```

```tsx
    const player: RenderLayer<unknown> = {
      id: 'player',
      label: 'Player',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const joints = resolveSkeleton(PLAYER_SKELETON, resolvePose(g.anim));
        // The rig's root sits at the body's feet, not its center.
        const at = { x: g.player.body.x, y: g.player.body.y + g.player.body.h / 2 };
        return drawPlayer(joints, view(), at, g.player.body.facing, g.invuln > 0 && Math.floor(g.invuln * 12) % 2 === 0);
      },
    };
    return { bands, tiles, player };
```

And the tick effect becomes the fixed-step loop:

```tsx
  useEffect(() => {
    let last = performance.now();
    return animator.onTick(() => {
      const now = performance.now();
      // A backgrounded tab hands back a huge delta; clamping stops the
      // accumulator from running hundreds of catch-up steps in one frame.
      const frame = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (!running) return;

      const g = game.current;
      g.accumulator += frame;
      while (g.accumulator >= STEP) {
        g.accumulator -= STEP;
        const step: Input = {
          left: input.current.left,
          right: input.current.right,
          jumpHeld: input.current.jumpHeld,
          jumpPressed: consumeJumpPress(input),
        };
        g.player = stepBody(g.player, WORLD, step, STEP);
        g.invuln = Math.max(0, g.invuln - STEP);
        if (spikeOverlap(g.player.body, WORLD) && g.invuln <= 0) {
          g.invuln = INVULN;
          g.player = { ...g.player, body: { ...g.player.body, vy: -300 } };
        }
        g.anim = nextAnimState(
          g.anim,
          {
            onGround: g.player.body.onGround,
            vx: g.player.body.vx,
            vy: g.player.body.vy,
            hurt: g.invuln > INVULN - 0.2,
          },
          STEP,
        );
      }
      g.camera = followCamera(g.camera, g.player.body, DIMS, WORLD, frame);
      audio.current?.engine.setListener({ x: g.player.body.x, y: g.player.body.y });
    });
  }, [animator, running, input]);
```

Add the layer to `SceneCanvas`:

```tsx
            player: { layer: layers.player, after: 'tiles' },
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit -- SideScrollerDemo platformer`
Expected: PASS, all platformer suites.

- [ ] **Step 5: See it in a browser**

Task 17 registers the demo, so until then check it with a temporary route or just
proceed — the mount test covers the wiring. If running the dev server:
`npm run dev:kit`, then the demo's hash route.

- [ ] **Step 6: Commit**

```bash
git add apps/site/demos/SideScrollerDemo.tsx apps/site/demos/__tests__/SideScrollerDemo.test.tsx
git commit -m "drive the platformer player with a fixed-step loop and a posed rig"
```

---

### Task 13: Audio engine and one-shots

**Files:**
- Modify: `apps/site/demos/SideScrollerDemo.tsx`

Web Audio starts suspended until a gesture unlocks it, so the demo shows an
"enable audio" button with the engine's live state next to it — the same shape
`AudioDemo` uses. jsdom has no `AudioContext`, so construction must be lazy and
guarded or the mount test breaks.

Sounds with a place in the world (a stomp, a swarm member) play through
`position`, with `engine.setListener` following the player — the engine's
`spatialize` then does the distance and pan math. Sounds belonging to the player
(jump, land, hurt) stay unpositioned, so they never drift off-center.

- [ ] **Step 1: Add a test that the demo mounts with no AudioContext**

```tsx
// append to apps/site/demos/__tests__/SideScrollerDemo.test.tsx
it('mounts in an environment with no Web Audio', () => {
  expect(typeof AudioContext).toBe('undefined');
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  render(<SideScrollerDemo />);
  expect(screen.getByRole('button', { name: /enable audio/i })).toBeTruthy();
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:kit -- SideScrollerDemo`
Expected: FAIL — no "enable audio" button yet.

- [ ] **Step 3: Wire the engine**

```tsx
import { createAudioEngine } from '@weasel-js/audio';
import type { AudioEngine, SoundHandle, VoiceHandle } from '@weasel-js/audio';
import { registerSounds, type SoundName } from './platformer/sfx';
```

```tsx
  const audio = useRef<{ engine: AudioEngine; sounds: Record<SoundName, SoundHandle>; bed: VoiceHandle | null } | null>(null);
  const [audioState, setAudioState] = useState<'off' | 'suspended' | 'running'>('off');

  // Built on the unlock gesture, not at mount: jsdom has no AudioContext, and a
  // context created before a gesture starts suspended anyway.
  const enableAudio = () => {
    if (typeof AudioContext === 'undefined') return;
    if (!audio.current) {
      const engine = createAudioEngine({ buses: ['sfx', 'music'], voiceLimit: 24 });
      audio.current = { engine, sounds: registerSounds(engine), bed: null };
    }
    const { engine } = audio.current;
    void engine.unlock().then(() => {
      setAudioState(engine.state() === 'running' ? 'running' : 'suspended');
      if (!audio.current!.bed) {
        audio.current!.bed = engine.play(audio.current!.sounds.bed, { bus: 'music', loop: true, gain: 0.5 });
      }
    });
  };

  useEffect(() => () => {
    audio.current?.engine.dispose();
    audio.current = null;
  }, []);

  const fire = (name: SoundName, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain });
  };

  /** Anything that happens at a place in the world plays from that place. The
   *  listener is the player, moved once per frame rather than per step. */
  const fireAt = (name: SoundName, at: { x: number; y: number }, gain = 0.8) => {
    const a = audio.current;
    if (!a || a.engine.state() !== 'running') return;
    a.engine.play(a.sounds[name], { bus: 'sfx', gain, position: at });
  };

  /** A hit drops the music under the hurt sound and brings it back. */
  const duckMusic = () => {
    const a = audio.current;
    if (!a) return;
    a.engine.bus('music').setGain(0.15, 60);
    window.setTimeout(() => a.engine.bus('music').setGain(0.5, 400), 260);
  };
```

Inside the fixed-step loop, after `stepBody`:

```tsx
        if (g.player.jumped) fire('jump', 0.6);
        if (g.player.landed) fire('land', 0.5);
```

and inside the spike branch:

```tsx
          fire('hurt');
          duckMusic();
```

Add to the toolbar:

```tsx
          <button className="ckd-btn" onClick={enableAudio} disabled={audioState === 'running'}>
            {audioState === 'running' ? 'audio on' : 'enable audio'}
          </button>
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit -- SideScrollerDemo`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/site/demos/SideScrollerDemo.tsx apps/site/demos/__tests__/SideScrollerDemo.test.tsx
git commit -m "wire the platformer's audio engine, music bed and one-shots"
```

---

### Task 14: The bridge — footsteps from a timeline event track

**Files:**
- Modify: `apps/site/demos/SideScrollerDemo.tsx`
- Test: `apps/site/demos/__tests__/platformerFootsteps.test.ts`

This is the task the whole demo exists for. The run cycle becomes a real
`animator.timeline({ loop: true })` carrying an `EventTrack` with a footfall at
each contact. Its `setTimeScale` tracks ground speed, and it pauses when the
player is not running.

**Measure the jitter.** `EventTrack` events are `{ t, fire: () => void }` — `fire`
receives nothing, so the handler cannot know the crossing time and can only ask
the engine for "now". The audio engine schedules with lookahead against
`AudioContext.currentTime`; a frame-resolution "now" throws that precision away.
Record the observed spread; it is the evidence for putting a time argument on
`fire`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/site/demos/__tests__/platformerFootsteps.test.ts
import { describe, it, expect } from 'vitest';
import { CLIPS } from '../platformer/clips';
import { FOOTFALLS, footstepTrack } from '../platformer/footsteps';

describe('footstepTrack', () => {
  it('puts one footfall at each contact of the run cycle', () => {
    expect(FOOTFALLS).toEqual([0, CLIPS.run.duration / 2]);
  });

  it('builds an event track that fires each footfall', () => {
    const fired: number[] = [];
    const track = footstepTrack((t) => fired.push(t));
    expect(track.kind).toBe('event');
    expect(track.events).toHaveLength(2);
    track.events.forEach((e) => e.fire());
    expect(fired).toEqual(FOOTFALLS);
  });

  it('hands the handler the authored time, which is all `fire()` can carry', () => {
    const seen: number[] = [];
    const track = footstepTrack((t) => seen.push(t));
    track.events[1].fire();
    // The authored `t`, not the crossing time — `fire()` takes no argument, so
    // the real playhead is unreachable from here. See docs/TODO.md.
    expect(seen).toEqual([CLIPS.run.duration / 2]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:kit -- platformerFootsteps`
Expected: FAIL — cannot resolve `../platformer/footsteps`.

- [ ] **Step 3: Write the track builder**

```ts
// apps/site/demos/platformer/footsteps.ts
import type { EventTrack } from '@weasel-js/core';
import { CLIPS } from './clips';

/** The two contacts in one run cycle, in milliseconds. */
export const FOOTFALLS = [0, CLIPS.run.duration / 2];

/**
 * An `EventTrack` firing at each footfall.
 *
 * `fire()` takes no arguments, so the handler is told the *authored* time and
 * has no way to learn the actual crossing time. Anything scheduling audio from
 * here is stuck asking the engine for "now" at frame resolution, which is the
 * jitter this demo is built to expose.
 */
export function footstepTrack(onStep: (authoredT: number) => void): EventTrack {
  return {
    kind: 'event',
    label: 'footsteps',
    events: FOOTFALLS.map((t) => ({ t, fire: () => onStep(t) })),
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:kit -- platformerFootsteps`
Expected: PASS, 3 tests.

- [ ] **Step 5: Drive the timeline from the demo**

```tsx
import { footstepTrack } from './platformer/footsteps';
import type { TimelineHandle } from '@weasel-js/core';
import { CLIPS } from './platformer/clips';
import { MOVE_SPEED } from './platformer/physics';
```

```tsx
  const runCycle = useRef<TimelineHandle | null>(null);
  const stepStats = useRef({ count: 0, lastAt: 0, spread: 0 });

  useEffect(() => {
    const handle = animator.timeline({
      loop: true,
      autoplay: true,
      tracks: [
        footstepTrack(() => {
          const a = audio.current;
          const now = performance.now();
          const s = stepStats.current;
          if (s.lastAt) {
            const gap = now - s.lastAt;
            const expected = (CLIPS.run.duration / 2) / Math.max(runScale.current, 0.01);
            s.spread = Math.max(s.spread, Math.abs(gap - expected));
          }
          s.lastAt = now;
          s.count++;
          if (!a || a.engine.state() !== 'running') return;
          // `fire()` gave us no crossing time, so "now" is the best available —
          // at frame resolution, not the sample resolution the engine wants.
          a.engine.play(a.sounds.step, { bus: 'sfx', gain: 0.35, when: a.engine.now() });
        }),
      ],
      duration: CLIPS.run.duration,
    });
    runCycle.current = handle;
    handle.pause();
    return () => {
      handle.cancel();
      runCycle.current = null;
    };
  }, [animator]);
```

`runScale` is a ref the loop writes so the footstep handler can compute the
expected gap:

```tsx
  const runScale = useRef(1);
```

At the end of each fixed step, keep the cycle in sync with the player:

```tsx
        const grounded = g.player.body.onGround;
        const speed = Math.abs(g.player.body.vx);
        const cycle = runCycle.current;
        if (cycle) {
          if (grounded && speed > 1) {
            runScale.current = Math.max(speed / MOVE_SPEED, 0.2);
            cycle.setTimeScale(runScale.current);
            if (cycle.isPaused()) cycle.resume();
          } else if (!cycle.isPaused()) {
            cycle.pause();
          }
        }
```

- [ ] **Step 6: Run every platformer test**

Run: `npm run test:kit -- platformer SideScrollerDemo`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos/platformer/footsteps.ts apps/site/demos/SideScrollerDemo.tsx apps/site/demos/__tests__/platformerFootsteps.test.ts
git commit -m "fire the platformer's footsteps from a looping timeline event track"
```

---

### Task 15: Enemies, coins, the goal, and dying

**Files:**
- Modify: `apps/site/demos/SideScrollerDemo.tsx`

- [ ] **Step 1: Extend `GameRefs`**

```tsx
import { atGoal, createCoins, createEnemies, resolveContacts, stepEnemy, INVULN, type Coin, type Enemy } from './platformer/entities';
import { drawCoins, drawEnemies, drawGoal } from './platformer/skin';

interface GameRefs {
  camera: Camera;
  player: BodyState;
  anim: AnimState;
  invuln: number;
  accumulator: number;
  enemies: Enemy[];
  coins: Coin[];
  lives: number;
  score: number;
  elapsed: number;
  outcome: 'playing' | 'won' | 'lost';
}

const freshGame = (): GameRefs => ({
  camera: createCamera(WORLD.spawn),
  player: createBodyState(WORLD.spawn),
  anim: createAnimState(),
  invuln: 0,
  accumulator: 0,
  enemies: createEnemies(WORLD.enemies),
  coins: createCoins(WORLD.coins),
  lives: 3,
  score: 0,
  elapsed: 0,
  outcome: 'playing',
});
```

- [ ] **Step 2: Add the entity layer**

```tsx
    const entities: RenderLayer<unknown> = {
      id: 'entities',
      label: 'Entities',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const v = view();
        return [
          ...drawGoal(WORLD.goal, v, (g.elapsed % 1.6) / 1.6),
          ...drawCoins(g.coins, v, (g.elapsed % 1.2) / 1.2),
          ...drawEnemies(g.enemies, v),
        ];
      },
    };
```

Mount it under the player so the player draws in front:

```tsx
            entities: { layer: layers.entities, after: 'tiles' },
            player: { layer: layers.player, after: 'entities' },
```

- [ ] **Step 3: Resolve contacts inside the fixed step**

Add after the spike check:

```tsx
        g.elapsed += STEP;
        g.enemies = g.enemies.map((e) => stepEnemy(e, WORLD, STEP));

        for (const hit of resolveContacts(g.player.body, g.enemies, g.coins, g.invuln)) {
          if (hit.kind === 'coin') {
            g.coins[hit.index].taken = true;
            g.score++;
            fire('coin', 0.5);
          } else if (hit.kind === 'stomp') {
            const victim = g.enemies[hit.index];
            g.enemies[hit.index].alive = false;
            g.player = { ...g.player, body: { ...g.player.body, vy: -300 } };
            fireAt('stomp', { x: victim.x, y: victim.y }, 0.7);
          } else {
            g.invuln = INVULN;
            g.lives--;
            g.player = {
              ...g.player,
              body: { ...g.player.body, vy: -280, vx: g.player.body.facing * -120 },
            };
            fire('hurt');
            duckMusic();
          }
        }

        // Falling out of the level costs a life and returns to the spawn.
        if (g.player.body.y > WORLD.heightPx + 100) {
          g.lives--;
          g.player = createBodyState(WORLD.spawn);
          g.camera = createCamera(WORLD.spawn);
          g.invuln = INVULN;
          fire('hurt');
        }

        if (g.lives <= 0 && g.outcome === 'playing') {
          g.outcome = 'lost';
        } else if (atGoal(g.player.body, WORLD.goal) && g.outcome === 'playing') {
          g.outcome = 'won';
          fire('goal', 0.9);
        }
```

Halt the simulation once the run is decided, but keep drawing:

```tsx
      if (g.outcome !== 'playing') return;
```

placed immediately after `const g = game.current;` and before the accumulator
advances.

- [ ] **Step 4: Add a restart control**

```tsx
  const restart = () => {
    game.current = freshGame();
    setNonce((n) => n + 1);
  };
```

with `const [, setNonce] = useState(0);` so the HUD readouts refresh, and a
button in the toolbar:

```tsx
          <button className="ckd-btn" onClick={restart}>restart</button>
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:kit -- platformer SideScrollerDemo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/site/demos/SideScrollerDemo.tsx
git commit -m "add enemies, coins, lives and a goal to the platformer"
```

---

### Task 16: HUD and the load-test panel

**Files:**
- Modify: `apps/site/demos/SideScrollerDemo.tsx`

Instrumentation is the deliverable, not decoration — the demo is a measuring
instrument. Readouts refresh on a 5 Hz interval rather than per frame, so the
panel never becomes the thing being measured.

- [ ] **Step 1: Add a test for the panel**

```tsx
// append to apps/site/demos/__tests__/SideScrollerDemo.test.tsx
it('shows the load-test readouts and the swarm control', () => {
  render(<SideScrollerDemo />);
  expect(screen.getByText(/frame/i)).toBeTruthy();
  expect(screen.getByText(/voices/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /swarm/i })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: /collision boxes/i })).toBeTruthy();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:kit -- SideScrollerDemo`
Expected: FAIL — no such text or controls.

- [ ] **Step 3: Add the HUD layer**

```tsx
import { textCommand } from '@weasel-js/core';
import { rectPath } from '@weasel-js/core';
import { COLORS } from './platformer/skin';
import { BODY_H, BODY_W } from './platformer/physics';
import { ENEMY_H, ENEMY_W } from './platformer/entities';
```

```tsx
    const hud: RenderLayer<unknown> = {
      id: 'hud',
      label: 'HUD',
      space: 'screen',
      draw: (): DrawCommand[] => {
        const g = game.current;
        const style = { fontFamily: 'sans-serif', fontSize: 14, fill: { fill: 'solid' as const, color: '#f0e6d8' } };
        const out: DrawCommand[] = [
          textCommand(12, 22, `♥ ${Math.max(g.lives, 0)}`, style),
          textCommand(72, 22, `◆ ${g.score} / ${g.coins.length}`, style),
          textCommand(190, 22, `${g.elapsed.toFixed(1)}s`, style),
        ];
        if (g.outcome !== 'playing') {
          out.push(
            textCommand(W / 2 - 60, H / 2, g.outcome === 'won' ? 'you made it' : 'out of lives', {
              ...style,
              fontSize: 26,
            }),
          );
        }
        return out;
      },
    };

    const debug: RenderLayer<unknown> = {
      id: 'debug',
      label: 'Collision boxes',
      space: 'screen',
      defaultVisible: false,
      draw: (): DrawCommand[] => {
        const g = game.current;
        const v = view();
        const box = (x: number, y: number, w: number, h: number, color: string): DrawCommand => {
          const p = worldToScreen(v, x - w / 2, y - h / 2);
          return {
            kind: 'path',
            path: rectPath(p.x, p.y, w * v.scale.x, h * v.scale.y),
            stroke: { width: 1, paint: { fill: 'solid', color } },
          };
        };
        return [
          box(g.player.body.x, g.player.body.y, BODY_W, BODY_H, '#7ee787'),
          ...g.enemies.filter((e) => e.alive).map((e) => box(e.x, e.y, ENEMY_W, ENEMY_H, '#ff7b72')),
        ];
      },
    };
```

Import `worldToScreen` from `./platformer/camera`, and mount both:

```tsx
            debug: { layer: layers.debug, after: 'player' },
            hud: { layer: layers.hud, after: 'debug' },
```

Gate the debug layer on a piece of React state so the checkbox controls it:

```tsx
  const [showBoxes, setShowBoxes] = useState(false);
```

and give `debug.draw` an early `if (!showBoxesRef.current) return [];` reading a
ref kept in sync:

```tsx
  const showBoxesRef = useRef(false);
  useEffect(() => { showBoxesRef.current = showBoxes; }, [showBoxes]);
```

- [ ] **Step 4: Add the DOM panel**

```tsx
  const [stats, setStats] = useState({ frame: 0, voices: 0, steps: 0, spread: 0 });
  const frameMs = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStats({
        frame: frameMs.current,
        voices: audio.current?.engine.activeVoices() ?? 0,
        steps: stepStats.current.count,
        spread: stepStats.current.spread,
      });
    }, 200);
    return () => window.clearInterval(id);
  }, []);
```

with `frameMs.current = frame * 1000;` written at the top of the tick, and the
panel itself:

```tsx
        <div className="ckd-toolbar">
          <span className="ckd-readout">frame {stats.frame.toFixed(1)} ms</span>
          <span className="ckd-readout">voices {stats.voices}</span>
          <span className="ckd-readout">footsteps {stats.steps}</span>
          <span className="ckd-readout">step jitter {stats.spread.toFixed(1)} ms</span>
          <label className="ckd-field">
            <input
              type="checkbox"
              checked={showBoxes}
              onChange={(e) => setShowBoxes(e.target.checked)}
            />
            collision boxes
          </label>
          <button className="ckd-btn" onClick={swarm}>swarm +40</button>
        </div>
```

- [ ] **Step 5: Add the swarm button**

```tsx
  /** Drop forty enemies around the player and fire a one-shot for each, so voice
   *  stealing and the per-frame cost of a crowd both become visible. */
  const swarm = () => {
    const g = game.current;
    const extra = Array.from({ length: 40 }, (_, i) => ({
      x: g.player.body.x + (i % 20) * 18 - 180,
      y: g.player.body.y - 40,
    }));
    g.enemies = [...g.enemies, ...createEnemies(extra)];
    const a = audio.current;
    if (a && a.engine.state() === 'running') {
      extra.forEach((p, i) =>
        a.engine.play(a.sounds.stomp, {
          bus: 'sfx',
          gain: 0.2,
          position: p,
          when: a.engine.now() + i * 15,
        }),
      );
    }
  };
```

- [ ] **Step 6: Run the tests**

Run: `npm run test:kit -- platformer SideScrollerDemo`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos/SideScrollerDemo.tsx apps/site/demos/__tests__/SideScrollerDemo.test.tsx
git commit -m "add the platformer HUD and its load-test readouts"
```

---

### Task 17: Register the demo, and record what it found

**Files:**
- Modify: `apps/site/registry.ts`
- Modify: `docs/TODO.md`
- Create: `.changeset/side-scroller-demo.md`

- [ ] **Step 1: Register the demo**

Add the two imports next to the existing ones in `apps/site/registry.ts`:

```ts
import { SideScrollerDemo } from './demos/SideScrollerDemo';
import SideScrollerDemoFull from './demos/SideScrollerDemo.tsx?raw';
```

and the entry in `DEMOS`. `'Animation'` is the category `TimelineDemo` already
uses; a new string would add a section to the site's nav.

```ts
  {
    id: 'side-scroller',
    title: 'Side-scroller',
    category: 'Animation',
    description:
      'A platformer that load-tests the animation timeline and the audio engine: a rig posed by cross-faded pose clips, footsteps fired from a looping event track, and synthesized audio with no assets.',
    hint: 'Arrow keys or WASD to move, space to jump.',
    Component: SideScrollerDemo,
    full: SideScrollerDemoFull,
    path: 'apps/site/demos/SideScrollerDemo.tsx',
  },
```

`autoExtras()` picks up every `./platformer/*` module the demo imports, so they
need no manual `extras` entries.

- [ ] **Step 2: Verify the registration**

Run: `npm run test:kit -- registry`
Then: `npx tsc --noEmit`
Expected: both clean.

- [ ] **Step 3: Play it**

```bash
npm run dev:kit
```

Open the printed URL at `#side-scroller`. Confirm, in order:

1. The player runs, jumps, and lands; limbs swing and the cross-fade between
   clips is not a visible snap.
2. "enable audio" turns the state readout to running and the music bed starts.
3. Footsteps fire in time with the feet, and speed up when the player does.
4. Coins, stomps, spikes and the goal all make their sounds; a hit ducks the music.
5. "swarm +40" raises the voice readout and shows stealing at the 24-voice limit.
6. The frame readout stays under 16 ms with the swarm on screen.
7. Camera feel. `DEAD_ZONE_Y` is 20 world units, which tracks jumps closely and
   may read as bouncy — raise it if the view pumps on every hop. This is the one
   constant that cannot be settled without watching it.

Write down the step-jitter readout while running at full speed — it is the
number Step 5 records.

- [ ] **Step 4: Record the findings in `docs/TODO.md`**

Under `## Animation`, replace the "Side-scroller demo" block (which describes the
demo as future work) with what it found. Write only what actually reproduced —
delete any prediction the demo disproved.

```markdown
### Side-scroller demo — landed

`apps/site/demos/SideScrollerDemo.tsx`, with its game logic in
`apps/site/demos/platformer/`. What it surfaced:

- **(P1) `EventTrack` events cannot see their own crossing time.** An event is
  `{ t, fire: () => void }`, so a handler scheduling audio can only ask the
  engine for "now" — frame resolution against a scheduler built for sample
  resolution. Footsteps on the run cycle drift by <MEASURED> ms at full speed.
  A time argument on `fire` closes it: `fire(crossedAt: number)`.
- **(P2) No key-state poll.** `key-held` gives edges only, so the demo
  reconstructs a held set from them in `platformer/useInput.ts`. Every
  character controller will rewrite that.
- **(P2) Held keys stick when the window loses focus.** No `keyup` arrives, so
  the dispatcher leaves the binding open. `useInput.ts` guards it with a `blur`
  listener; the dispatcher should.
```

Leave the existing `setLoop` P2 and the tiled-layer P3 where they are, adding a
sentence to each naming the demo as a second site that wants them.

- [ ] **Step 5: Write the changeset**

Per `CLAUDE.md`, **every changeset is `patch`** — never `minor`, never `major`,
regardless of what the change does. Raising it needs an explicit approval marker
that only Mike writes.

```markdown
---
'@weasel-js/core': patch
---

Add a side-scroller demo that load-tests the animation timeline and the audio
engine. The player is an eleven-joint rig posed by cross-faded `SampledTrack<Pose>`
clips; its footsteps fire from an `EventTrack` on a looping `animator.timeline`
whose time scale tracks ground speed. All audio is synthesized at load, so the
demo ships no assets.
```

- [ ] **Step 6: Full verification**

```bash
npx tsc --noEmit && npm test && npm run build
```
Expected: all clean. Report the actual output — if anything fails, say so rather
than describing the change as done.

- [ ] **Step 7: Commit**

```bash
git add apps/site/registry.ts docs/TODO.md .changeset/side-scroller-demo.md
git commit -m "register the side-scroller demo and record the gaps it found"
```

---

## Done when

- `npm test` and `npx tsc --noEmit` are clean.
- The demo is playable at `#side-scroller`: run, jump, collect, stomp, die, win.
- The swarm button pushes the voice count to the pool limit without dropping frames.
- `docs/TODO.md` records the measured findings, with real numbers rather than the
  predictions this plan carries.
