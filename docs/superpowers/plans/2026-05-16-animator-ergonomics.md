# Animator Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pause/resume/timeScale, unified physics primitive, loop, and stagger to `src/animation/`, per `docs/superpowers/specs/2026-05-16-animator-ergonomics-design.md`.

**Architecture:** Per-animation virtual clock substrate underneath every active animation. Spring and decay collapse into one `physics` primitive that supports `setTarget` mid-flight. Loop and stagger are composition primitives that wrap any `AnimationHandle`.

**Tech Stack:** React + TypeScript, vitest, existing `src/animation/` module.

---

## File structure

- **Modify** `src/animation/types.ts` — extend `AnimationHandle`, add `PhysicsHandle`, `PhysicsOptions`, `LoopOptions`, `TweenLoopOptions`, `StaggerOptions`, `StaggerBuilder`. Extend `Animator` and `UseAnimatorOptions`.
- **Modify** `src/animation/useAnimator.ts` — add virtual-clock state to `ActiveAnimation`, route ticks through it, add pause/resume/timeScale (global + per-handle + by key), replace `spring` and `decay` with `physics` + sugar.
- **Modify** `src/animation/useAnimator.test.tsx` — add tests for virtual clock, pause/resume/timeScale, physics parity with old spring/decay.
- **Create** `src/animation/loop.ts` — `createLoop(animator, factory, opts)` + `createTweenLoop(animator, opts)` exported standalone; bound as `animator.loop` / `animator.tweenLoop` in `useAnimator`.
- **Create** `src/animation/loop.test.ts` — tests for loop primitive + tweenLoop direction modes.
- **Create** `src/animation/stagger.ts` — `createStagger(animator, items, delay, factory?)` + `StaggerBuilder` class; bound as `animator.stagger`.
- **Create** `src/animation/stagger.test.ts` — primitive + builder tests.
- **Modify** `src/animation/index.ts` — export new types/helpers.
- **Modify** `demo/demos/AnimationDemo.tsx` — add pause slider, breathing handle, stagger fade-in, flick→snap panel.
- **Modify** `docs/TODO.md` — mark four follow-ups done; remove from open list.

---

## Phase A — Virtual clock substrate

### Task 1: Extend `AnimationHandle` and `ActiveAnimation` with virtual-clock state

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`

- [ ] **Step 1: Write failing test for `handle.pause()` freezing a tween**

Append to `src/animation/useAnimator.test.tsx`:

```ts
it('handle.pause() freezes the tween value at the pause moment', () => {
  const { animator, advance } = mountAnimator();
  const values: number[] = [];
  const handle = animator.tween({
    from: 0, to: 100, ms: 1000,
    easing: (t) => t,
    onTick: (v) => values.push(v),
  });
  advance(0);          // virtualNow 0 → value ~0
  advance(250);        // virtualNow 250 → value ~25
  handle.pause();
  advance(500);        // 750ms of wall time, but paused → no advance
  expect(values[values.length - 1]).toBeCloseTo(25, 0);
  handle.resume();
  advance(250);        // virtualNow 500 → value ~50
  expect(values[values.length - 1]).toBeCloseTo(50, 0);
});
```

(Note: `mountAnimator` is the existing test harness with `now` + `requestFrame` injection. If a different harness name is in use, follow the file's existing pattern.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'handle.pause'`
Expected: FAIL — `handle.pause is not a function`.

- [ ] **Step 3: Extend `AnimationHandle` in types.ts**

In `src/animation/types.ts`, replace the `AnimationHandle` interface:

```ts
export interface AnimationHandle {
  id: number;
  cancel(): void;
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
  isPaused(): boolean;
}
```

- [ ] **Step 4: Add virtual-clock state and routing in useAnimator.ts**

In `src/animation/useAnimator.ts`, change `ActiveAnimation` to:

```ts
interface ActiveAnimation {
  id: number;
  cancelKey?: string;
  paused: boolean;
  timeScale: number;
  virtualNow: number;
  lastRealNow: number | null;
  tick(virtualNow: number): boolean;
  onCancel?(): void;
}
```

In `tickAll`, replace the body that calls `anim.tick(t)` with:

```ts
for (const anim of animations.current.values()) {
  const realDt = anim.lastRealNow == null ? 0 : t - anim.lastRealNow;
  anim.lastRealNow = t;
  const scale = globalTimeScale.current * (anim.paused ? 0 : anim.timeScale);
  anim.virtualNow += realDt * scale;
  tickDepth.current += 1;
  try {
    if (anim.tick(anim.virtualNow)) finished.push(anim.id);
  } finally {
    tickDepth.current -= 1;
  }
}
```

Add at the top of `useAnimator`:

```ts
const globalTimeScale = useRef(1);
const globalPaused = useRef(false);
```

(globalPaused is set up here for Task 3; reading it sets `scale = 0` once that task lands.)

Change `register` to initialize the new fields and return an extended handle:

```ts
const register = (anim: ActiveAnimation): AnimationHandle => {
  if (anim.cancelKey != null) cancelByKey(anim.cancelKey);
  anim.paused = false;
  anim.timeScale = 1;
  anim.virtualNow = 0;
  anim.lastRealNow = null;
  animations.current.set(anim.id, anim);
  ensureLoop();
  return {
    id: anim.id,
    cancel: () => {
      const a = animations.current.get(anim.id);
      if (!a) return;
      a.onCancel?.();
      animations.current.delete(anim.id);
    },
    pause: () => { const a = animations.current.get(anim.id); if (a) a.paused = true; },
    resume: () => { const a = animations.current.get(anim.id); if (a) a.paused = false; },
    setTimeScale: (s) => { const a = animations.current.get(anim.id); if (a) a.timeScale = s; },
    isPaused: () => animations.current.get(anim.id)?.paused ?? false,
  };
};
```

Update each `tick(nowMs)` to use `virtualNow` semantics. The tween's `start` must be captured in **virtual** time on the first tick, not at registration:

In `tween()`, change:
```ts
const start = now();
```
to:
```ts
let start: number | null = null;
```
and at the top of `tick(nowMs)` (where `nowMs` is now `virtualNow`):
```ts
if (start == null) start = nowMs;
const elapsed = nowMs - start;
```

Spring and decay already key off `lastTime` initialized to `null` on first tick — those continue to work unchanged because they accept the incoming time as authoritative.

- [ ] **Step 5: Run the test, verify pass**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'handle.pause'`
Expected: PASS.

- [ ] **Step 6: Run all animation tests to verify no regressions**

Run: `npx vitest run src/animation/`
Expected: PASS (existing tests unaffected by virtual-clock substrate).

- [ ] **Step 7: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "feat(animation): per-animation virtual clock substrate + handle.pause/resume/setTimeScale"
```

---

### Task 2: Animator-global `pause` / `resume` / `setTimeScale`

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/useAnimator.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `useAnimator.test.tsx`:

```ts
it('animator.pause() freezes every animation', () => {
  const { animator, advance } = mountAnimator();
  const a: number[] = [];
  const b: number[] = [];
  animator.tween({ from: 0, to: 10, ms: 1000, easing: t => t, onTick: v => a.push(v) });
  animator.tween({ from: 0, to: 20, ms: 1000, easing: t => t, onTick: v => b.push(v) });
  advance(100);
  animator.pause();
  expect(animator.isPaused()).toBe(true);
  const aBefore = a[a.length - 1];
  const bBefore = b[b.length - 1];
  advance(500);
  expect(a[a.length - 1]).toBeCloseTo(aBefore, 1);
  expect(b[b.length - 1]).toBeCloseTo(bBefore, 1);
});

it('animator.setTimeScale(0.5) halves the animation rate', () => {
  const { animator, advance } = mountAnimator();
  const samples: number[] = [];
  animator.tween({ from: 0, to: 100, ms: 1000, easing: t => t, onTick: v => samples.push(v) });
  animator.setTimeScale(0.5);
  advance(200);
  expect(samples[samples.length - 1]).toBeCloseTo(10, 0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'animator.pause|setTimeScale'`
Expected: FAIL — `animator.pause is not a function`.

- [ ] **Step 3: Extend `Animator` interface**

In `src/animation/types.ts`, add to `Animator`:

```ts
pause(): void;
resume(): void;
isPaused(): boolean;
setTimeScale(scale: number): void;
```

- [ ] **Step 4: Implement in useAnimator.ts**

In the returned animator object, add:

```ts
pause: () => { globalPaused.current = true; },
resume: () => { globalPaused.current = false; },
isPaused: () => globalPaused.current,
setTimeScale: (s) => { globalTimeScale.current = s; },
```

Update the scale computation in `tickAll` to honor `globalPaused`:

```ts
const scale = globalPaused.current
  ? 0
  : globalTimeScale.current * (anim.paused ? 0 : anim.timeScale);
```

- [ ] **Step 5: Run tests to verify pass**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'animator.pause|setTimeScale'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "feat(animation): animator-global pause/resume/setTimeScale"
```

---

### Task 3: `pauseKey` / `resumeKey` / `setTimeScaleByKey`

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/useAnimator.test.tsx`

- [ ] **Step 1: Write failing test**

```ts
it('pauseKey freezes matching animations only', () => {
  const { animator, advance } = mountAnimator();
  const a: number[] = [], b: number[] = [];
  animator.tween({ from: 0, to: 10, ms: 1000, easing: t => t, cancelKey: 'foo', onTick: v => a.push(v) });
  animator.tween({ from: 0, to: 10, ms: 1000, easing: t => t, cancelKey: 'bar', onTick: v => b.push(v) });
  advance(100);
  animator.pauseKey('foo');
  const aFrozen = a[a.length - 1];
  advance(500);
  expect(a[a.length - 1]).toBeCloseTo(aFrozen, 1);
  expect(b[b.length - 1]).toBeGreaterThan(aFrozen);
});
```

- [ ] **Step 2: Run test to verify fail**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'pauseKey'`
Expected: FAIL.

- [ ] **Step 3: Extend `Animator` interface**

```ts
pauseKey(key: string): void;
resumeKey(key: string): void;
setTimeScaleByKey(key: string, scale: number): void;
```

- [ ] **Step 4: Implement**

```ts
const forEachByKey = (key: string, fn: (a: ActiveAnimation) => void) => {
  for (const a of animations.current.values()) if (a.cancelKey === key) fn(a);
};

pauseKey: (key) => forEachByKey(key, a => { a.paused = true; }),
resumeKey: (key) => forEachByKey(key, a => { a.paused = false; }),
setTimeScaleByKey: (key, s) => forEachByKey(key, a => { a.timeScale = s; }),
```

- [ ] **Step 5: Run test, verify pass**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'pauseKey'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "feat(animation): pauseKey/resumeKey/setTimeScaleByKey"
```

---

## Phase B — Unified physics primitive

### Task 4: Add `physics()` with `setTarget` / `setVelocity`

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/useAnimator.test.tsx`

- [ ] **Step 1: Add `PhysicsOptions` / `PhysicsHandle` types**

In `src/animation/types.ts`:

```ts
export interface PhysicsOptions<T> {
  from: T;
  to?: T | null;
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  restThreshold?: number;
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface PhysicsHandle<T = unknown> extends AnimationHandle {
  setTarget(to: T | null): void;
  setVelocity(v: T): void;
}
```

Add to `Animator`:

```ts
physics<T>(opts: PhysicsOptions<T>): PhysicsHandle<T>;
```

- [ ] **Step 2: Write failing test — parity with existing spring**

```ts
it('physics with to set matches spring numerically', () => {
  const { animator, advance } = mountAnimator();
  const springValues: number[] = [];
  const physicsValues: number[] = [];
  animator.spring({
    from: 0, to: 100, stiffness: 170, damping: 26, mass: 1,
    onTick: v => springValues.push(v),
  });
  animator.physics({
    from: 0, to: 100, stiffness: 170, damping: 26, mass: 1,
    onTick: v => physicsValues.push(v),
  });
  for (let i = 0; i < 30; i++) advance(16);
  expect(physicsValues.length).toBe(springValues.length);
  for (let i = 0; i < springValues.length; i++) {
    expect(physicsValues[i]).toBeCloseTo(springValues[i], 5);
  }
});

it('physics with to: null behaves as exponential decay', () => {
  const { animator, advance } = mountAnimator();
  const samples: number[] = [];
  // damping=1, mass=1, stiffness=0 → v(t) = v0 * exp(-t)
  animator.physics({
    from: 0, to: null, velocity: 100,
    stiffness: 0, damping: 1, mass: 1,
    onTick: v => samples.push(v),
  });
  for (let i = 0; i < 60; i++) advance(16);
  // After ~1 second of decay with c/m=1, velocity ~37% of initial.
  // Position approaches v0 * m/c = 100. Allow generous tolerance.
  expect(samples[samples.length - 1]).toBeGreaterThan(50);
  expect(samples[samples.length - 1]).toBeLessThan(105);
});
```

- [ ] **Step 3: Run tests, expect FAIL** (`animator.physics is not a function`)

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'physics'`

- [ ] **Step 4: Implement `physics()`**

In `useAnimator.ts`, add (replacing the body of the existing `spring` lambda, or inserting before it):

```ts
const physics = <T,>(o: PhysicsOptions<T>): PhysicsHandle<T> => {
  const id = nextId.current++;
  const isNumeric = typeof o.from === 'number';
  if (!isNumeric && (!o.add || !o.subtract || !o.scale || !o.magnitude)) {
    throw new Error('physics: add/subtract/scale/magnitude are required for non-numeric T');
  }
  const add = o.add ?? ((a: T, b: T) => ((a as number) + (b as number)) as unknown as T);
  const subtract = o.subtract ?? ((a: T, b: T) => ((a as number) - (b as number)) as unknown as T);
  const scale = o.scale ?? ((v: T, k: number) => ((v as number) * k) as unknown as T);
  const magnitude = o.magnitude ?? ((v: T) => Math.abs(v as unknown as number));
  const { stiffness: kBase, damping, mass } = resolveSpringConstants(o);
  const restThreshold = o.restThreshold ?? 0.01;

  let target: T | null = o.to ?? null;
  let stiffness = target == null ? 0 : kBase;
  let value = o.from;
  let velocity: T = (o.velocity ?? scale(o.from, 0)) as T;
  let lastTime: number | null = null;

  const handle = register({
    id,
    cancelKey: o.cancelKey,
    paused: false, timeScale: 1, virtualNow: 0, lastRealNow: null,
    tick(nowMs) {
      if (tripwire()) return true;
      if (lastTime == null) { lastTime = nowMs; o.onTick(value); return false; }
      const dt = Math.min(0.064, (nowMs - lastTime) / 1000);
      lastTime = nowMs;
      const ref = target ?? value;
      const displacement = subtract(value, ref);
      const springForce = scale(displacement, -stiffness);
      const dampingForce = scale(velocity, -damping);
      const accel = scale(add(springForce, dampingForce), 1 / mass);
      velocity = add(velocity, scale(accel, dt));
      value = add(value, scale(velocity, dt));
      o.onTick(value);
      // Rest condition: target-mode requires position+velocity convergence;
      // decay-mode requires velocity convergence only.
      const velRested = magnitude(velocity) < restThreshold;
      const posRested = target == null ? true : magnitude(subtract(value, target)) < restThreshold;
      if (velRested && posRested) {
        if (target != null) o.onTick(target);
        o.onDone?.();
        return true;
      }
      return false;
    },
  }) as PhysicsHandle<T>;

  handle.setTarget = (newTo: T | null) => {
    target = newTo;
    stiffness = newTo == null ? 0 : kBase;
  };
  handle.setVelocity = (v: T) => { velocity = v; };
  return handle;
};
```

Add `physics` to the returned object alongside `tween`, `spring`, `decay`.

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'physics'`
Expected: PASS.

- [ ] **Step 6: Add setTarget test**

```ts
it('physics setTarget retargets mid-flight, preserving velocity', () => {
  const { animator, advance } = mountAnimator();
  const samples: number[] = [];
  const handle = animator.physics({
    from: 0, to: 100, stiffness: 170, damping: 26, mass: 1,
    onTick: v => samples.push(v),
  });
  for (let i = 0; i < 10; i++) advance(16);  // approach 100
  handle.setTarget(0);                        // reverse target mid-flight
  for (let i = 0; i < 60; i++) advance(16);
  // Final value should converge toward 0
  expect(samples[samples.length - 1]).toBeCloseTo(0, 0);
});

it('physics setTarget(null) switches to decay; velocity preserved', () => {
  const { animator, advance } = mountAnimator();
  const samples: number[] = [];
  const handle = animator.physics({
    from: 0, to: 100, stiffness: 170, damping: 26, mass: 1,
    onTick: v => samples.push(v),
  });
  for (let i = 0; i < 5; i++) advance(16);  // build velocity
  const velocityHint = samples[samples.length - 1] - samples[samples.length - 2];
  handle.setTarget(null);
  for (let i = 0; i < 100; i++) advance(16);
  // With damping pulling velocity to 0, position should drift further then settle.
  expect(samples[samples.length - 1]).toBeGreaterThan(samples[5]);
  if (velocityHint > 0) expect(samples[samples.length - 1]).toBeGreaterThan(samples[5]);
});
```

Run: `npx vitest run src/animation/useAnimator.test.tsx -t 'setTarget'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "feat(animation): unified physics primitive with setTarget/setVelocity"
```

---

### Task 5: Reimplement `spring` and `decay` as sugar over `physics`

**Files:**
- Modify: `src/animation/useAnimator.ts`

- [ ] **Step 1: Replace `spring` body**

In `useAnimator.ts`, replace the body of the `spring` arrow with:

```ts
const spring = <T,>(o: SpringOptions<T>): AnimationHandle => physics<T>({
  from: o.from, to: o.to, velocity: o.velocity,
  preset: o.preset, stiffness: o.stiffness, damping: o.damping, mass: o.mass,
  restThreshold: o.restThreshold,
  add: o.add, subtract: o.subtract, scale: o.scale, magnitude: o.magnitude,
  onTick: o.onTick, onDone: o.onDone, cancelKey: o.cancelKey,
});
```

- [ ] **Step 2: Replace `decay` body**

```ts
const decay = <T,>(o: DecayOptions<T>): AnimationHandle => {
  const friction = o.friction ?? 0.95;
  // Per-second friction → damping coefficient (m=1, k=0):
  //   v(t) = v0 * friction^t  ⇔  m*dv/dt = -c*v with c = -ln(friction)
  const damping = -Math.log(friction);
  return physics<T>({
    from: o.from,
    to: null,
    velocity: o.velocity,
    stiffness: 0,
    damping,
    mass: 1,
    restThreshold: o.threshold ?? 0.5,
    add: o.add,
    subtract: (a, b) => o.add(a, o.scale(b, -1)),
    scale: o.scale,
    magnitude: o.magnitude,
    onTick: o.onTick,
    onDone: o.onDone,
    cancelKey: o.cancelKey,
  });
};
```

- [ ] **Step 3: Run all animation tests**

Run: `npx vitest run src/animation/`
Expected: PASS — existing spring/decay tests still pass via the sugar wrappers.

- [ ] **Step 4: Run momentum behavior tests**

Run: `npx vitest run src/animation/behaviors/momentum.test.ts`
Expected: PASS — `momentum` uses `decay` under the hood.

- [ ] **Step 5: Commit**

```bash
git add src/animation/useAnimator.ts
git commit -m "refactor(animation): spring and decay become sugar over physics"
```

---

## Phase C — `loop`

### Task 6: Loop primitive

**Files:**
- Create: `src/animation/loop.ts`
- Create: `src/animation/loop.test.ts`
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/index.ts`

- [ ] **Step 1: Add types**

In `src/animation/types.ts`:

```ts
export interface LoopOptions {
  count?: number;
  cancelKey?: string;
  onDone?: () => void;
}

export type LoopFactory = (iteration: number) => AnimationHandle;
```

Add to `Animator`:

```ts
loop(factory: LoopFactory, opts?: LoopOptions): AnimationHandle;
```

- [ ] **Step 2: Write failing test**

Create `src/animation/loop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() =>
    useAnimator({
      now: () => now,
      requestFrame: (cb) => { frameCbs.push(cb); return frameCbs.length; },
      cancelFrame: () => {},
    }),
  );
  const advance = (ms: number) => {
    now += ms;
    const due = frameCbs.splice(0);
    for (const cb of due) cb(now);
  };
  return { animator: result.current, advance };
}

describe('animator.loop', () => {
  it('re-invokes the factory each iteration until count', () => {
    const { animator, advance } = mountAnimator();
    const iterations: number[] = [];
    const handle = animator.loop(
      (i) => {
        iterations.push(i);
        return animator.tween({ from: 0, to: 1, ms: 100, easing: t => t, onTick: () => {} });
      },
      { count: 3 },
    );
    for (let i = 0; i < 50; i++) advance(16);
    expect(iterations).toEqual([0, 1, 2]);
  });

  it('cancel cancels the current child and prevents future iterations', () => {
    const { animator, advance } = mountAnimator();
    const iterations: number[] = [];
    const handle = animator.loop((i) => {
      iterations.push(i);
      return animator.tween({ from: 0, to: 1, ms: 100, easing: t => t, onTick: () => {} });
    });
    advance(16);
    advance(50);
    handle.cancel();
    for (let i = 0; i < 10; i++) advance(50);
    expect(iterations.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `npx vitest run src/animation/loop.test.ts`
Expected: FAIL — `animator.loop is not a function`.

- [ ] **Step 4: Implement loop primitive**

Create `src/animation/loop.ts`:

```ts
import type { Animator, AnimationHandle, LoopFactory, LoopOptions } from './types';

export function createLoop(
  animator: Animator,
  factory: LoopFactory,
  opts: LoopOptions = {},
): AnimationHandle {
  const max = opts.count ?? Infinity;
  let iteration = 0;
  let cancelled = false;
  let current: AnimationHandle | null = null;

  const startNext = (): void => {
    if (cancelled) return;
    if (iteration >= max) { opts.onDone?.(); return; }
    const i = iteration++;
    const child = factory(i);
    // Wrap the child so when it finishes naturally, the loop advances.
    // We can't observe onDone after the fact, so the factory must already
    // wire onDone into its returned handle. Instead we poll via a sentinel
    // handle: we wrap the child's cancel and replace the factory's onDone
    // indirectly by patching. Simpler: instrument via the factory contract.
    current = child;
    // Patch cancel to also stop loop if cancel originated externally.
    const origCancel = child.cancel;
    child.cancel = () => { origCancel(); if (current === child) current = null; };
    // The factory is expected to chain into `startNext` via onDone. To support
    // that uniformly, we instead use a tick-poll: check each frame whether
    // the child has cleared its animation slot. Simpler implementation:
    // require the factory to pass through onDone -> loop. We expose a helper.
    // Implementation: we wrap by re-issuing the child with an onDone callback.
    // To avoid that complexity, this primitive accepts a factory that returns
    // a handle which we observe via a poller. See below.
    void child;
  };

  // Poller: every animator frame, check if current child is still in flight.
  // Since handles don't expose "is alive," we use `animator.isActive(key)` if
  // the child has a cancelKey, OR we wrap the child via a sentinel tween.
  // SIMPLER MODEL: the factory wires its onDone to call `next()` via a
  // closure exposed on the loop handle. To keep the API clean, loop accepts
  // a thin factory variant: factory(i, next) where next is called by the
  // factory's wrapped onDone. Update the LoopFactory type accordingly.

  // (See revised implementation below.)

  startNext();

  return {
    id: -1,
    cancel: () => { cancelled = true; current?.cancel(); current = null; },
    pause: () => { current?.pause(); },
    resume: () => { current?.resume(); },
    setTimeScale: (s) => { current?.setTimeScale(s); },
    isPaused: () => current?.isPaused() ?? false,
  };
}
```

The above sketch reveals an API issue: a handle has no `onDone`. **Resolve it by changing the factory signature** to receive a `next` callback:

```ts
export type LoopFactory = (iteration: number, next: () => void) => AnimationHandle;
```

Update `src/animation/types.ts` accordingly. The factory wires its returned handle's `onDone` (or equivalent) to call `next`.

Replace the implementation body of `createLoop` with:

```ts
export function createLoop(
  animator: Animator,
  factory: LoopFactory,
  opts: LoopOptions = {},
): AnimationHandle {
  const max = opts.count ?? Infinity;
  let iteration = 0;
  let cancelled = false;
  let current: AnimationHandle | null = null;
  let id = -1;

  const next = (): void => {
    if (cancelled) return;
    if (iteration >= max) { current = null; opts.onDone?.(); return; }
    const i = iteration++;
    current = factory(i, next);
    if (id === -1) id = current.id;
  };

  next();

  return {
    get id() { return id; },
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      current?.cancel();
      current = null;
    },
    pause: () => { current?.pause(); },
    resume: () => { current?.resume(); },
    setTimeScale: (s) => { current?.setTimeScale(s); },
    isPaused: () => current?.isPaused() ?? false,
  } as AnimationHandle;
}
```

In `useAnimator.ts`, add at the top of the file:

```ts
import { createLoop } from './loop';
```

And in the returned object:

```ts
loop: (factory, opts) => createLoop({ ...returnedAnimator }, factory, opts),
```

Wait — `returnedAnimator` is the object being built. Resolve by closing over a ref:

```ts
const animatorRef: { current: Animator | null } = { current: null };
// ... at end:
const api: Animator = { tween, spring, decay, physics, /* ... */, loop: (f, o) => createLoop(animatorRef.current!, f, o), /* ... */ };
animatorRef.current = api;
return api;
```

- [ ] **Step 5: Update the test to use the `next` callback signature**

Update `src/animation/loop.test.ts`:

```ts
it('re-invokes the factory each iteration until count', () => {
  const { animator, advance } = mountAnimator();
  const iterations: number[] = [];
  animator.loop(
    (i, next) => {
      iterations.push(i);
      return animator.tween({
        from: 0, to: 1, ms: 100, easing: t => t,
        onTick: () => {},
        onDone: next,
      });
    },
    { count: 3 },
  );
  for (let i = 0; i < 30; i++) advance(16);
  expect(iterations).toEqual([0, 1, 2]);
});

it('cancel prevents future iterations and cancels current child', () => {
  const { animator, advance } = mountAnimator();
  const iterations: number[] = [];
  const handle = animator.loop((i, next) => {
    iterations.push(i);
    return animator.tween({
      from: 0, to: 1, ms: 100, easing: t => t,
      onTick: () => {}, onDone: next,
    });
  });
  advance(16);
  advance(50);
  handle.cancel();
  for (let i = 0; i < 10; i++) advance(50);
  expect(iterations.length).toBe(1);
});
```

- [ ] **Step 6: Run loop tests, verify pass**

Run: `npx vitest run src/animation/loop.test.ts`
Expected: PASS.

- [ ] **Step 7: Export from index**

In `src/animation/index.ts`, add:

```ts
export { createLoop } from './loop';
```

- [ ] **Step 8: Commit**

```bash
git add src/animation/loop.ts src/animation/loop.test.ts src/animation/types.ts src/animation/useAnimator.ts src/animation/index.ts
git commit -m "feat(animation): loop primitive (animator.loop)"
```

---

### Task 7: `tweenLoop` sugar with direction

**Files:**
- Create: extend `src/animation/loop.ts`
- Modify: `src/animation/loop.test.ts`
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/index.ts`

- [ ] **Step 1: Add `TweenLoopOptions` type**

In `src/animation/types.ts`:

```ts
export interface TweenLoopOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;
  direction?: 'restart' | 'reverse' | 'alternate';
  count?: number;
  interpolate?: Interpolate<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}
```

Add to `Animator`:

```ts
tweenLoop<T>(opts: TweenLoopOptions<T>): AnimationHandle;
```

- [ ] **Step 2: Write failing tests**

Append to `loop.test.ts`:

```ts
describe('animator.tweenLoop', () => {
  it('direction=restart plays from→to each iteration', () => {
    const { animator, advance } = mountAnimator();
    const values: number[] = [];
    animator.tweenLoop({
      from: 0, to: 10, ms: 100, easing: t => t,
      direction: 'restart', count: 2,
      onTick: v => values.push(v),
    });
    for (let i = 0; i < 30; i++) advance(16);
    // Sequence should jump back to ~0 between iterations.
    const peakIndex = values.indexOf(Math.max(...values.slice(0, 10)));
    expect(values[peakIndex + 1]).toBeLessThan(values[peakIndex]);
  });

  it('direction=alternate flips from/to each iteration', () => {
    const { animator, advance } = mountAnimator();
    const values: number[] = [];
    animator.tweenLoop({
      from: 0, to: 10, ms: 100, easing: t => t,
      direction: 'alternate', count: 2,
      onTick: v => values.push(v),
    });
    for (let i = 0; i < 30; i++) advance(16);
    const max = Math.max(...values);
    const last = values[values.length - 1];
    expect(max).toBeCloseTo(10, 0);
    expect(last).toBeLessThan(2);
  });
});
```

- [ ] **Step 3: Run tests, expect FAIL**

Run: `npx vitest run src/animation/loop.test.ts -t 'tweenLoop'`

- [ ] **Step 4: Implement `createTweenLoop`**

Append to `src/animation/loop.ts`:

```ts
import type { TweenLoopOptions } from './types';

export function createTweenLoop<T>(
  animator: Animator,
  opts: TweenLoopOptions<T>,
): AnimationHandle {
  const direction = opts.direction ?? 'restart';
  return createLoop(
    animator,
    (i, next) => {
      let from = opts.from, to = opts.to;
      if (direction === 'reverse') { from = opts.to; to = opts.from; }
      else if (direction === 'alternate' && i % 2 === 1) { from = opts.to; to = opts.from; }
      return animator.tween({
        from, to, ms: opts.ms,
        easing: opts.easing,
        interpolate: opts.interpolate,
        onTick: opts.onTick,
        onDone: next,
      });
    },
    { count: opts.count, cancelKey: opts.cancelKey, onDone: opts.onDone },
  );
}
```

In `useAnimator.ts`, add `tweenLoop` to the api:

```ts
tweenLoop: (opts) => createTweenLoop(animatorRef.current!, opts),
```

Update `src/animation/index.ts`:

```ts
export { createLoop, createTweenLoop } from './loop';
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/animation/loop.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/loop.ts src/animation/loop.test.ts src/animation/types.ts src/animation/useAnimator.ts src/animation/index.ts
git commit -m "feat(animation): tweenLoop sugar with restart/reverse/alternate"
```

---

## Phase D — `stagger`

### Task 8: Add timer injection to `UseAnimatorOptions`

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`

- [ ] **Step 1: Extend `UseAnimatorOptions`**

```ts
export interface UseAnimatorOptions {
  // existing fields...
  setTimer?: (cb: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}
```

- [ ] **Step 2: Expose resolved timer fns to the animator object**

This is needed so `stagger` can pick up the injected timer. Add to the api object:

```ts
_timers: {
  setTimer: (cb: () => void, ms: number): unknown =>
    (optsRef.current.setTimer ?? ((c, m) => setTimeout(c, m)))(cb, ms),
  clearTimer: (h: unknown): void =>
    (optsRef.current.clearTimer ?? ((x) => clearTimeout(x as ReturnType<typeof setTimeout>)))(h),
},
```

Add the field to the `Animator` interface as well:

```ts
/** Internal: injectable timer pair, used by stagger. Not part of the
 *  public contract but exposed so loop/stagger helpers can route through
 *  the same test-time injection points as the rAF loop. */
_timers: {
  setTimer: (cb: () => void, ms: number) => unknown;
  clearTimer: (h: unknown) => void;
};
```

- [ ] **Step 3: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts
git commit -m "feat(animation): injectable timers in useAnimator for stagger"
```

---

### Task 9: Stagger primitive

**Files:**
- Create: `src/animation/stagger.ts`
- Create: `src/animation/stagger.test.ts`
- Modify: `src/animation/types.ts`
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/index.ts`

- [ ] **Step 1: Types**

In `src/animation/types.ts`:

```ts
export type StaggerDelay = number | ((index: number) => number);
export type StaggerFactory<TItem> = (item: TItem, index: number) => AnimationHandle;

export interface StaggerBuilder<TItem> {
  each(factory: StaggerFactory<TItem>): AnimationHandle;
  // (further methods added in Task 10)
}

declare module './types' {
  interface Animator {
    stagger<TItem>(items: TItem[], delay: StaggerDelay): StaggerBuilder<TItem>;
    stagger<TItem>(items: TItem[], delay: StaggerDelay, factory: StaggerFactory<TItem>): AnimationHandle;
  }
}
```

(If the `declare module` augmentation is awkward, instead just add both overloads directly to the `Animator` interface.)

- [ ] **Step 2: Write failing tests**

Create `src/animation/stagger.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const timers: Array<{ cb: () => void; due: number; cleared: boolean }> = [];
  const { result } = renderHook(() =>
    useAnimator({
      now: () => now,
      requestFrame: (cb) => { frameCbs.push(cb); return frameCbs.length; },
      cancelFrame: () => {},
      setTimer: (cb, ms) => {
        const entry = { cb, due: now + ms, cleared: false };
        timers.push(entry);
        return entry;
      },
      clearTimer: (h) => { (h as { cleared: boolean }).cleared = true; },
    }),
  );
  const advance = (ms: number) => {
    const target = now + ms;
    while (now < target) {
      const nextTimer = Math.min(...timers.filter(t => !t.cleared && t.due > now).map(t => t.due), target);
      const next = Math.min(target, nextTimer);
      now = next;
      const due = frameCbs.splice(0);
      for (const cb of due) cb(now);
      for (const t of timers) {
        if (!t.cleared && t.due <= now) {
          t.cleared = true;
          t.cb();
        }
      }
    }
  };
  return { animator: result.current, advance };
}

describe('animator.stagger', () => {
  it('factory form fires each child at the right delay', () => {
    const { animator, advance } = mountAnimator();
    const starts: Array<{ item: string; t: number }> = [];
    let t = 0;
    animator.stagger(
      ['a', 'b', 'c'],
      50,
      (item) => {
        starts.push({ item, t });
        return animator.tween({
          from: 0, to: 1, ms: 10, easing: x => x, onTick: () => {},
        });
      },
    );
    advance(0); t = 0;
    advance(50); t = 50;
    advance(50); t = 100;
    advance(50);
    expect(starts.map(s => s.item)).toEqual(['a', 'b', 'c']);
  });

  it('cancel cancels pending timers and in-flight children', () => {
    const { animator, advance } = mountAnimator();
    const starts: string[] = [];
    const handle = animator.stagger(['a', 'b', 'c'], 100, (item) => {
      starts.push(item);
      return animator.tween({
        from: 0, to: 1, ms: 1000, easing: t => t, onTick: () => {},
      });
    });
    advance(50);  // 'a' has started
    handle.cancel();
    advance(500); // 'b' and 'c' should never start
    expect(starts).toEqual(['a']);
  });
});
```

- [ ] **Step 3: Run tests, expect FAIL**

Run: `npx vitest run src/animation/stagger.test.ts`

- [ ] **Step 4: Implement**

Create `src/animation/stagger.ts`:

```ts
import type {
  Animator, AnimationHandle, StaggerBuilder, StaggerDelay, StaggerFactory,
} from './types';

class CompositeHandle implements AnimationHandle {
  id = -1;
  private cancelled = false;
  private paused = false;
  private timeScale = 1;
  private children: AnimationHandle[] = [];
  private pending: { timer: unknown; remainingMs: number; resolvedAt: number; fire: () => void }[] = [];

  constructor(private animator: Animator) {}

  addChild(h: AnimationHandle): void {
    if (this.cancelled) { h.cancel(); return; }
    this.children.push(h);
    if (this.paused) h.pause();
    if (this.timeScale !== 1) h.setTimeScale(this.timeScale);
  }

  schedule(delayMs: number, fire: () => void, now: () => number): void {
    if (this.cancelled) return;
    const resolvedAt = now() + delayMs;
    const wrappedFire = (): void => { if (!this.cancelled) fire(); };
    const timer = this.animator._timers.setTimer(wrappedFire, delayMs);
    this.pending.push({ timer, remainingMs: delayMs, resolvedAt, fire });
  }

  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true;
    for (const p of this.pending) this.animator._timers.clearTimer(p.timer);
    this.pending = [];
    for (const c of this.children) c.cancel();
    this.children = [];
  }

  pause(): void {
    this.paused = true;
    for (const c of this.children) c.pause();
    // Pending timers are not pausable on the host; clearing here would lose
    // the schedule. We snapshot remaining ms and clear; resume() re-schedules.
    // (Minimal v1: skip pause of pending timers — document as a follow-up.)
  }
  resume(): void {
    this.paused = false;
    for (const c of this.children) c.resume();
  }
  setTimeScale(s: number): void {
    this.timeScale = s;
    for (const c of this.children) c.setTimeScale(s);
  }
  isPaused(): boolean { return this.paused; }
}

function delayFor(delay: StaggerDelay, i: number): number {
  return typeof delay === 'function' ? delay(i) : delay * i;
}

export function createStagger<TItem>(
  animator: Animator,
  items: TItem[],
  delay: StaggerDelay,
  factory?: StaggerFactory<TItem>,
): AnimationHandle | StaggerBuilder<TItem> {
  if (factory) return run(animator, items, delay, factory);
  return makeBuilder(animator, items, delay);
}

function run<TItem>(
  animator: Animator,
  items: TItem[],
  delay: StaggerDelay,
  factory: StaggerFactory<TItem>,
): AnimationHandle {
  const composite = new CompositeHandle(animator);
  items.forEach((item, i) => {
    const ms = delayFor(delay, i);
    const fire = (): void => { composite.addChild(factory(item, i)); };
    if (ms <= 0) fire();
    else composite.schedule(ms, fire, () => performance.now());
  });
  return composite;
}

function makeBuilder<TItem>(
  animator: Animator,
  items: TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  return {
    each: (factory) => run(animator, items, delay, factory),
  };
}
```

Wire in `useAnimator.ts`:

```ts
import { createStagger } from './stagger';
// in api:
stagger: ((items, delay, factory) =>
  createStagger(animatorRef.current!, items, delay, factory)) as Animator['stagger'],
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npx vitest run src/animation/stagger.test.ts`
Expected: PASS.

- [ ] **Step 6: Export from index**

```ts
export { createStagger } from './stagger';
```

- [ ] **Step 7: Commit**

```bash
git add src/animation/stagger.ts src/animation/stagger.test.ts src/animation/types.ts src/animation/useAnimator.ts src/animation/index.ts
git commit -m "feat(animation): stagger primitive with composite handle"
```

---

### Task 10: Fluent builder methods on `StaggerBuilder`

**Files:**
- Modify: `src/animation/types.ts`
- Modify: `src/animation/stagger.ts`
- Modify: `src/animation/stagger.test.ts`

- [ ] **Step 1: Extend `StaggerBuilder` type**

```ts
type PerItem<T, TItem> = T | ((item: TItem, index: number) => T);

export interface StaggerTweenOptions<T, TItem> {
  from: PerItem<T, TItem>;
  to: PerItem<T, TItem>;
  ms: PerItem<number, TItem>;
  easing?: EasingFn;
  interpolate?: Interpolate<T>;
  onTick: (value: T, item: TItem, index: number) => void;
  onDone?: (item: TItem, index: number) => void;
  cancelKey?: string;
}

export interface StaggerSpringPoseOptions<TPose, TItem> {
  pose: PerItem<TPose, TItem>;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: PoseDescriptor<TPose>;
  recordOp?: boolean;
  opLabel?: string;
}

export interface StaggerBuilder<TItem> {
  each(factory: StaggerFactory<TItem>): AnimationHandle;
  tween<T>(opts: StaggerTweenOptions<T, TItem>): AnimationHandle;
  // springPose accepts the animator + adapter implicitly via closure:
  // signature parallels existing springPose helper but takes `pose` per item.
  springPose<TPose>(
    adapter: SceneAdapter<{ id: string }, TPose>,
    poseFn: (item: TItem, i: number) => TPose,
    opts?: Omit<StaggerSpringPoseOptions<TPose, TItem>, 'pose'>,
  ): AnimationHandle;
}
```

Import `PoseDescriptor`, `SceneAdapter`, `SpringPresetName` as needed at the top of `types.ts` (re-export from existing modules or move them to `types.ts`).

Note: keeping the surface tight here — `.tween` and `.springPose` cover the two most useful cases. `.spring`, `.physics`, `.tweenPose` left as a follow-up: easy additive change once a consumer needs them.

- [ ] **Step 2: Failing test for `.tween`**

```ts
it('builder .tween closes over per-item options', () => {
  const { animator, advance } = mountAnimator();
  const results: Array<{ item: string; v: number }> = [];
  animator
    .stagger(['a', 'b', 'c'], 0)
    .tween({
      from: 0,
      to: (_item, i) => (i + 1) * 10,
      ms: 100,
      easing: t => t,
      onTick: (v, item) => results.push({ item, v }),
    });
  for (let i = 0; i < 20; i++) advance(16);
  // Each item reaches its `to` ((i+1)*10): final values per item should
  // be 10, 20, 30 respectively.
  const finals: Record<string, number> = {};
  for (const r of results) finals[r.item] = r.v;
  expect(finals.a).toBeCloseTo(10, 0);
  expect(finals.b).toBeCloseTo(20, 0);
  expect(finals.c).toBeCloseTo(30, 0);
});
```

- [ ] **Step 3: Implement `.tween`**

In `stagger.ts`, extend `makeBuilder`:

```ts
function resolve<T, TItem>(v: PerItem<T, TItem>, item: TItem, i: number): T {
  return typeof v === 'function' ? (v as (item: TItem, i: number) => T)(item, i) : v;
}

function makeBuilder<TItem>(
  animator: Animator,
  items: TItem[],
  delay: StaggerDelay,
): StaggerBuilder<TItem> {
  return {
    each: (factory) => run(animator, items, delay, factory),
    tween: (opts) => run(animator, items, delay, (item, i) =>
      animator.tween({
        from: resolve(opts.from, item, i),
        to: resolve(opts.to, item, i),
        ms: resolve(opts.ms, item, i),
        easing: opts.easing,
        interpolate: opts.interpolate,
        onTick: (v) => opts.onTick(v, item, i),
        onDone: opts.onDone ? () => opts.onDone!(item, i) : undefined,
        cancelKey: opts.cancelKey,
      })
    ),
    springPose: (adapter, poseFn, opts = {}) => run(animator, items, delay, (item, i) => {
      // Inline lazy import to avoid circular dep: stagger -> poseHelpers -> animation/index -> stagger
      const { springPose } = require('./poseHelpers') as typeof import('./poseHelpers');
      return springPose(animator, adapter, {
        id: (item as unknown as { id: string }).id ?? String(item),
        to: poseFn(item, i),
        preset: opts.preset,
        stiffness: opts.stiffness,
        damping: opts.damping,
        mass: opts.mass,
        geometry: opts.geometry,
        recordOp: opts.recordOp,
        opLabel: opts.opLabel,
      });
    }),
  };
}
```

(If `require` is unavailable in the build setup, use a top-of-file import and accept the dependency — the import order is fine because `poseHelpers` doesn't import `stagger`.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/animation/stagger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/animation/stagger.ts src/animation/stagger.test.ts src/animation/types.ts
git commit -m "feat(animation): fluent stagger builder — .tween and .springPose"
```

---

## Phase E — Demo and TODO cleanup

### Task 11: Extend AnimationDemo with new features

**Files:**
- Modify: `demo/demos/AnimationDemo.tsx`

- [ ] **Step 1: Read the current demo**

Use `Read` on `demo/demos/AnimationDemo.tsx` to understand its layout.

- [ ] **Step 2: Add a global time-scale slider**

Add a slider control bound to `animator.setTimeScale(value)`. Range 0–2, default 1. Label "Time scale". Place it in whatever control panel the demo already has.

```tsx
const [timeScale, setTimeScale] = useState(1);
useEffect(() => animator.setTimeScale(timeScale), [animator, timeScale]);

<label>
  Time scale: {timeScale.toFixed(2)}
  <input type="range" min={0} max={2} step={0.05} value={timeScale}
         onChange={e => setTimeScale(Number(e.target.value))} />
</label>
<button onClick={() => animator.isPaused() ? animator.resume() : animator.pause()}>
  {animator.isPaused() ? 'Resume' : 'Pause'}
</button>
```

- [ ] **Step 3: Add a breathing handle on the selected card**

When a card is selected, start a `tweenLoop` that pulses its scale or alpha. Cancel it when selection changes.

```tsx
useEffect(() => {
  if (!selectedId) return;
  const handle = animator.tweenLoop({
    from: 1.0, to: 1.06, ms: 800,
    easing: easeInOutSine,
    direction: 'alternate',
    onTick: (v) => setCardScale(selectedId, v),
  });
  return () => handle.cancel();
}, [selectedId, animator]);
```

(If the demo doesn't expose `setCardScale`, wire it through the same path that `setCardAlpha` uses, or animate `setPose` on the existing card adapter.)

- [ ] **Step 4: Add a stagger fade-in for multi-select**

When multiple cards become selected, fade them in with `animator.stagger(ids, 50).tween({ from: 0.3, to: 1, ms: 300, onTick: ... })`. (If the demo already shows multi-select, plug into that path.)

- [ ] **Step 5: Add a flick-snap panel demonstrating physics.setTarget**

Add a draggable panel that on release uses `animator.physics({ from: position, to: null, velocity: dragVelocity })` for decay; if velocity carries it past a threshold, call `handle.setTarget(snapTarget)` mid-flight to spring to the nearest grid cell.

```tsx
const startFlick = (initialPos: Point, velocity: Point): void => {
  const handle = animator.physics<Point>({
    from: initialPos,
    to: null,
    velocity,
    damping: 5,
    add: addP, subtract: subP, scale: scaleP, magnitude: magP,
    onTick: setPanelPos,
  });
  // After 300ms, snap to nearest grid cell.
  setTimeout(() => handle.setTarget(nearestCell(panelPosRef.current)), 300);
};
```

- [ ] **Step 6: Run demo manually**

Run: `npm run dev` and navigate to `#animation` (or whatever route the demo uses). Verify:
- Time-scale slider visibly changes animation speed
- Pause button freezes scene
- Selecting a card produces a breathing pulse
- Multi-select shows stagger fade-in
- Flick panel shows snap

- [ ] **Step 7: Commit**

```bash
git add demo/demos/AnimationDemo.tsx
git commit -m "demo(animation): pause slider, breathing handle, stagger, flick-snap"
```

---

### Task 12: Update TODO.md

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Mark the four items shipped**

Edit the "Deferred from animation primitive (2026-05-04)" section of `docs/TODO.md`. The current section lists:

- Ambient / looping animations
- Spring "no destination" mode
- Synchronized animations / staggers
- Animator pause / resume / time-scale

Replace these four lines with a single line:

```markdown
- [x] **Animator ergonomics: virtual clock, unified physics, loop, stagger.** *Shipped 2026-05-16.* Spec: `docs/superpowers/specs/2026-05-16-animator-ergonomics-design.md`. Plan: `docs/superpowers/plans/2026-05-16-animator-ergonomics.md`. Adds `animator.pause/resume/setTimeScale` (animator-global + per-handle + by cancelKey), unifies `spring`/`decay` into `physics({ from, to?, velocity? })` with `setTarget`/`setVelocity` for mid-flight retargeting, `animator.loop` + `tweenLoop({ direction })`, `animator.stagger` with fluent builder. `spring` and `decay` keep working as sugar.
```

- [ ] **Step 2: Run prepublishOnly gate**

Run: `npm run prepublishOnly` (or `tsc --noEmit && npx vitest run && tsup build`).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(TODO): mark animator ergonomics shipped"
```

---

## Self-review check

- Spec coverage: virtual clock (Task 1–3) ✓; unified physics + setTarget (Task 4–5) ✓; loop primitive + tweenLoop sugar (Task 6–7) ✓; stagger primitive + fluent builder (Task 8–10) ✓; demo (Task 11) ✓; TODO update (Task 12) ✓.
- The fluent builder ships with `.each`, `.tween`, `.springPose`. `.spring`, `.physics`, `.tweenPose` deferred as additive — call out in commit / docs if a real driver appears.
- Type coupling: `Animator._timers` is exposed publicly but marked as internal in its docstring; stagger reaches in. If this seam pinches, promote to a sibling object.
