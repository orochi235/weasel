# Animator on blits, step 3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: unbuilt.** Written 2026-10-02 on branch `pose-overrides-mix`, after Mike approved step 3 at
about 1.5× today's frame (`docs/proposals/2026-09-30-animator-on-blits.md`, "What step 3 has to
answer first"). Delete this file when the work merges.

**Goal:** `animator.tween`, `spring`, `physics` and `decay` compute their values in blits instead
of in `useAnimator.ts`, with every public signature unchanged.

**Architecture:** Each animator owns a *bank*: a set of blits voices, each on a mix of its own. Every
animation call is one subject of the bank, named by its animation id. Calls that can share a voice do: one voice per distinct
easing for tweens, and one per distinct `(stiffness, damping, mass, axis count)` for physics. Each
frame the animator syncs the bank once, reads every voice's subjects with `mix.pull`, and hands each
call its value through `onTick` as today. A call whose own handle is paused or re-rated moves to a
voice of its own; cancel and interrupt fade its subject out at once.

**Tech Stack:** TypeScript, React hooks, vitest (`--project=core`), `@msb235/blits`.

---

## Decisions this plan makes

Each is a call the proposal left open. Mike can overturn any of them before Task 1 starts.

| Question | This plan's answer | Why |
|---|---|---|
| What a tween computes in blits | Eased progress `u` from 0 to 1; weasel still calls `interpolate(from, to, u)` | `TweenOptions<T>` takes any `T` with a caller's interpolator. blits moves numbers only |
| What a spring computes in blits | The value itself, as axes, when `T` is a number, a number array or an object of numeric fields | `setTarget` retargets in `T`'s own space, so progress alone cannot carry it |
| A `T` that is none of those | Stays on today's integrator, in its own file | No caller in the tree does this. `Vec2` (demo) and `RectLike` (momentum) both qualify for axes |
| Keyframe sampling (`timeline/sampleTrack.ts`) | Not in this plan | Timelines seek, scrub and edit their tracks, a separate subsystem. It gets its own plan |
| Per-call pause and rate | Moved to a voice of its own, seeked to the call's elapsed time | A blits handle controls a whole voice |
| Global pause and rate | The bank's clock advances at the global rate | blits fades run on the mix clock, so a held clock holds fades too (proposal, "Pausing fades") |

## Before Task 1

- **blits release.** Tasks need `tween`, `mix.pull` and `handle.fade({ subject })`, which are on blits
  `main` (`de5ba57` and later) and unreleased. core pins `@msb235/blits` exactly at `0.2.1`
  (`packages/core/package.json:92`). Develop against a local build installed into
  `node_modules/@msb235/blits` (the way the bench runs in `tests/perf/bench/animator-on-blits.bench.ts`
  were done); the pin moves when blits publishes, and this branch does not merge before then.
  Releasing blits is the blits session's call, not this plan's.
- **Tests.** Core's tests run from the repo root: `npx vitest run --project=core <path>`. Anything
  wider than the files a task touches goes to the fleet (`onto test`), not this machine.

## Files

| File | Change | Responsibility |
|---|---|---|
| `packages/core/src/animation/engine/axes.ts` | Create | Turn a value into a flat `number[]` and back, or say it cannot |
| `packages/core/src/animation/engine/axes.test.ts` | Create | |
| `packages/core/src/animation/engine/bank.ts` | Create | The animator's blits voices, shared and solo, with one `pull` per voice per frame |
| `packages/core/src/animation/engine/bank.test.ts` | Create | |
| `packages/core/src/animation/engine/blitsContract.test.ts` | Create | Pins each blits behavior `bank.ts` relies on, so a blits change fails here first |
| `packages/core/src/animation/engine/integrator.ts` | Create | Today's semi-implicit Euler, moved out of `useAnimator.ts`, for a `T` with no axes |
| `packages/core/src/animation/useAnimator.ts` | Modify | `tween`, `physics`, `spring`, `decay`, pause and rate route through the bank |
| `packages/core/src/animation/useAnimator.test.tsx` | Modify | Spring parity tests compare against the closed form, not Euler |
| `tests/perf/bench/animator-on-blits.bench.ts` | Modify | A row for the rebuilt animator itself |
| `docs/proposals/2026-09-30-animator-on-blits.md` | Modify | Step 3 status |
| `docs/TODO.md` | Modify | The "(P3) The animator on blits" entry |
| `.changeset/animator-on-blits.md` | Create | `patch` |

---

### Task 1: Pin the blits behaviors the bank relies on

The bank leans on six blits behaviors. Each gets a test against the real package, so a blits
release that changes one fails here, by name, instead of somewhere in `useAnimator`.

**Files:**
- Create: `packages/core/src/animation/engine/blitsContract.test.ts`

- [ ] **Step 1: Write the tests**

```ts
import { describe, expect, it } from 'vitest';
import { kit, mix, spring, sum, tween, vec } from '@msb235/blits';

type U = { u: number };
type P = { p: number[] };
const linear = (x: number) => x;

describe('blits behaviors the animator bank relies on', () => {
  it('a tween subject started with to(id, 1, at) is at ease((t - at) / ms)', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const ms = new Map([[1, 1000], [2, 500]]);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: (id) => ms.get(id)!, ease: linear });
    m.cue({ patch: tw });
    tw.to(1, 1, 0);
    tw.to(2, 1, 0);
    m.sync(250);
    const cols = { u: new Float64Array(2) };
    m.pull([1, 2], cols);
    expect(cols.u[0]).toBeCloseTo(0.25, 9);
    expect(cols.u[1]).toBeCloseTo(0.5, 9);
  });

  it('pull fills a subject no voice reaches with NaN', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const cols = { u: new Float64Array(1) };
    m.pull([7], cols);
    expect(Number.isNaN(cols.u[0])).toBe(true);
  });

  it('fade({ subject, over: 0 }) takes one subject off a voice and leaves the rest', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw });
    tw.to(1, 1, 0);
    tw.to(2, 1, 0);
    m.sync(100);
    h.fade({ subject: 1, over: 0 });
    m.sync(200);
    const cols = { u: new Float64Array(2) };
    m.pull([1, 2], cols);
    expect(Number.isNaN(cols.u[0])).toBe(true);
    expect(cols.u[1]).toBeCloseTo(0.2, 9);
  });

  it('a voice seeked to an elapsed time reads where the shared voice would', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw, subjects: [3] });
    tw.to(3, 1, 0);
    m.sync(100);
    h.seek(600);
    m.sync(100);
    const cols = { u: new Float64Array(1) };
    m.pull([3], cols);
    expect(cols.u[0]).toBeCloseTo(0.6, 9);
  });

  it('rate 0 holds a voice still', () => {
    const m = mix<number, U>(kit<U>({ u: sum() }));
    m.sync(0);
    const tw = tween<number, U>('u', { from: 0, to: 1, ms: 1000, ease: linear });
    const h = m.cue({ patch: tw });
    tw.to(1, 1, 0);
    m.sync(300);
    h.rate = 0;
    m.sync(900);
    const cols = { u: new Float64Array(1) };
    m.pull([1], cols);
    expect(cols.u[0]).toBeCloseTo(0.3, 9);
  });

  it('a spring carries position and velocity through to() and push()', () => {
    const m = mix<number, P>(kit<P>({ p: vec(2, sum()) }));
    m.sync(0);
    const sp = spring<number, P, number[]>('p', { from: [0, 0], to: [10, 0], stiffness: 170, damping: 26, mass: 1 });
    m.cue({ patch: sp });
    sp.to(1, [10, 0], 0);
    m.sync(100);
    const before = sp.read(1)!;
    sp.to(1, [0, 10]);
    const after = sp.read(1)!;
    expect(after.value).toEqual(before.value);
    expect(after.velocity).toEqual(before.velocity);
    sp.push(1, [5, 5]);
    expect(sp.read(1)!.velocity).toEqual([5, 5]);
  });
});
```

- [ ] **Step 2: Run them against the local blits build**

Run: `npx vitest run --project=core packages/core/src/animation/engine/blitsContract.test.ts`
Expected: 6 passed. A failure here means blits does not behave the way the bank below assumes: stop
and settle it with the blits session before writing Task 3. Do not adapt the test to whatever blits
returns.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/animation/engine/blitsContract.test.ts
git commit -m "pin the blits behaviors the animator bank will rely on"
```

### Task 2: Axes

A value blits can move is a flat `number[]`. `axesOf` decides once per call whether a `T` has
axes and returns the two conversions.

**Files:**
- Create: `packages/core/src/animation/engine/axes.ts`
- Test: `packages/core/src/animation/engine/axes.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { axesOf } from './axes';

describe('axesOf', () => {
  it('reads a number as one axis', () => {
    const a = axesOf(3)!;
    expect(a.count).toBe(1);
    expect(a.to(3)).toEqual([3]);
    expect(a.from([4])).toBe(4);
  });

  it('reads a number array as one axis per entry', () => {
    const a = axesOf([1, 2, 3])!;
    expect(a.count).toBe(3);
    expect(a.from([4, 5, 6])).toEqual([4, 5, 6]);
  });

  it('reads an object of numeric fields in key order, and rebuilds it', () => {
    const a = axesOf({ y: 2, x: 1 })!;
    expect(a.count).toBe(2);
    expect(a.to({ x: 1, y: 2 })).toEqual([1, 2]);
    expect(a.from([5, 6])).toEqual({ x: 5, y: 6 });
  });

  it('returns null for anything else', () => {
    expect(axesOf({ x: 1, label: 'a' })).toBeNull();
    expect(axesOf({ x: { y: 1 } })).toBeNull();
    expect(axesOf('a')).toBeNull();
    expect(axesOf(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=core packages/core/src/animation/engine/axes.test.ts`
Expected: FAIL, cannot resolve `./axes`.

- [ ] **Step 3: Implement**

```ts
/** How a value maps to the flat numbers blits moves, and back. */
export interface Axes<T> {
  count: number;
  to(v: T): number[];
  from(a: ArrayLike<number>): T;
}

/** The axes of `sample`'s shape: a number, a number array, or an object whose fields are all
 *  numbers. Null for any other shape, which blits cannot move. */
export function axesOf<T>(sample: T): Axes<T> | null {
  if (typeof sample === 'number') {
    return { count: 1, to: (v) => [v as number], from: (a) => a[0] as T };
  }
  if (Array.isArray(sample)) {
    if (!sample.every((x) => typeof x === 'number')) return null;
    return {
      count: sample.length,
      to: (v) => (v as number[]).slice(),
      from: (a) => Array.from(a) as T,
    };
  }
  if (sample === null || typeof sample !== 'object') return null;
  const keys = Object.keys(sample).sort();
  const rec = sample as Record<string, unknown>;
  if (keys.length === 0 || !keys.every((k) => typeof rec[k] === 'number')) return null;
  return {
    count: keys.length,
    to: (v) => keys.map((k) => (v as Record<string, number>)[k]!),
    from: (a) => {
      const out: Record<string, number> = {};
      for (let i = 0; i < keys.length; i++) out[keys[i]!] = a[i]!;
      return out as T;
    },
  };
}
```

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=core packages/core/src/animation/engine/axes.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/engine/axes.ts packages/core/src/animation/engine/axes.test.ts
git commit -m "add axes, which map a numeric value onto the flat numbers blits moves"
```

### Task 3: The bank

The bank is the only file that talks to blits. `useAnimator` asks it to start, move, retarget and
stop subjects, and once a frame to advance and read every subject's values.

**Files:**
- Create: `packages/core/src/animation/engine/bank.ts`
- Test: `packages/core/src/animation/engine/bank.test.ts`

The bank's interface, which later tasks use exactly as written:

```ts
export interface TweenStart { id: number; ms: number; ease: (u: number) => number; }
export interface SpringStart {
  id: number; axes: number;
  from: number[]; to: number[] | null; velocity: number[];
  stiffness: number; damping: number; mass: number;
}
export interface Bank {
  /** Advances the bank's clock by `dtMs` of animator time, then reads every subject. */
  frame(dtMs: number): void;
  tween(s: TweenStart): void;
  spring(s: SpringStart): void;
  /** Eased progress of a tween subject, as read by the last `frame`. */
  progress(id: number): number;
  /** Position and velocity of a spring subject at the last `frame`. */
  motion(id: number): { value: number[]; velocity: number[] };
  retarget(id: number, to: number[] | null): void;
  push(id: number, velocity: number[]): void;
  /** Moves `id` onto a voice of its own, at rate `rate`, without a jump. */
  solo(id: number, rate: number): void;
  stop(id: number): void;
}
export function createBank(): Bank;
```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { createBank } from './bank';

const linear = (u: number) => u;
const SPRING = { stiffness: 170, damping: 26, mass: 1 };

describe('createBank', () => {
  it('advances tweens sharing an easing on one voice, each by its own ms', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear });
    b.tween({ id: 2, ms: 500, ease: linear });
    b.frame(250);
    expect(b.progress(1)).toBeCloseTo(0.25, 9);
    expect(b.progress(2)).toBeCloseTo(0.5, 9);
  });

  it('starts a tween at the bank time it was added, not at zero', () => {
    const b = createBank();
    b.frame(400);
    b.tween({ id: 1, ms: 1000, ease: linear });
    b.frame(100);
    expect(b.progress(1)).toBeCloseTo(0.1, 9);
  });

  it('keeps a stopped subject out of the next frame and its neighbors running', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear });
    b.tween({ id: 2, ms: 1000, ease: linear });
    b.frame(100);
    b.stop(1);
    b.frame(100);
    expect(b.progress(2)).toBeCloseTo(0.2, 9);
    expect(() => b.progress(1)).toThrow(/no subject 1/);
  });

  it('solo at rate 0 freezes one tween and not its neighbor', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear });
    b.tween({ id: 2, ms: 1000, ease: linear });
    b.frame(300);
    b.solo(1, 0);
    b.frame(300);
    expect(b.progress(1)).toBeCloseTo(0.3, 9);
    expect(b.progress(2)).toBeCloseTo(0.6, 9);
  });

  it('solo at rate 2 runs one tween at double speed from where it was', () => {
    const b = createBank();
    b.tween({ id: 1, ms: 1000, ease: linear });
    b.frame(200);
    b.solo(1, 2);
    b.frame(100);
    expect(b.progress(1)).toBeCloseTo(0.4, 9);
  });

  it('moves a spring and keeps its velocity through a retarget', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: [10], velocity: [0], ...SPRING });
    b.frame(100);
    const before = b.motion(1);
    b.retarget(1, [0]);
    b.frame(0);
    expect(b.motion(1).velocity[0]).toBeCloseTo(before.velocity[0]!, 9);
  });

  it('decays toward rest with no target', () => {
    const b = createBank();
    b.spring({ id: 1, axes: 1, from: [0], to: null, velocity: [100], stiffness: 0, damping: 2, mass: 1 });
    b.frame(1000);
    const m = b.motion(1);
    expect(m.value[0]).toBeGreaterThan(0);
    expect(Math.abs(m.velocity[0]!)).toBeLessThan(100);
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run --project=core packages/core/src/animation/engine/bank.test.ts`
Expected: FAIL, cannot resolve `./bank`.

- [ ] **Step 3: Implement**

A voice is keyed by what its patch cannot vary per subject: a tween's easing function, or a
spring's constants and axis count. Each voice gets a mix of its own: a voice cued without
`subjects` reaches every subject a `pull` names, so two voices sharing a `sum` mix would add their
values into each other's subjects. A decay (`to: null`) is blits' `glide` when `stiffness` is 0;
everything else with a target is `spring`.

```ts
import { glide, kit, mix, spring as springPatch, sum, tween as tweenPatch, vec, type Handle, type Mix } from '@msb235/blits';

export interface TweenStart { id: number; ms: number; ease: (u: number) => number; }
export interface SpringStart {
  id: number; axes: number;
  from: number[]; to: number[] | null; velocity: number[];
  stiffness: number; damping: number; mass: number;
}
export interface Bank {
  frame(dtMs: number): void;
  tween(s: TweenStart): void;
  spring(s: SpringStart): void;
  progress(id: number): number;
  motion(id: number): { value: number[]; velocity: number[] };
  retarget(id: number, to: number[] | null): void;
  push(id: number, velocity: number[]): void;
  solo(id: number, rate: number): void;
  stop(id: number): void;
}

type Out = { v: number[] };

interface Voice {
  key: string;
  axes: number;
  mix: Mix<number, Out>;
  /** Bank time the voice was cued at. Its own clock reads bank time less this, while at rate 1. */
  cuedAt: number;
  handle: Handle<number>;
  patch: {
    to(id: number, target: number | number[], at?: number): void;
    read(id: number, at?: number): { value: number | number[]; velocity: number | number[] } | undefined;
    push?(id: number, velocity: number[], at?: number): void;
  };
  ids: number[];
  /** Rebuilt when `ids` changes, so `pull` sees the same array frame to frame. */
  cols: { v: Float64Array };
  solo: boolean;
}

interface Subject {
  voice: Voice;
  kind: 'tween' | 'spring';
  /** Bank time it started at; a tween's elapsed time is the bank's time less this. */
  start: number;
  ms: number;
  ease: (u: number) => number;
  spring?: SpringStart;
  slot: number;
}

export function createBank(): Bank {
  const voices = new Map<string, Voice>();
  const subjects = new Map<number, Subject>();
  let time = 0;
  const mixOf = (axes: number): Mix<number, Out> => {
    const m = mix<number, Out>(kit<Out>({ v: vec(axes, sum()) }));
    m.sync(time);
    return m;
  };
  /** Bank time as voice `v`'s clock reads it. Shared voices stay at rate 1; a solo voice is
   *  re-rated only after its one subject is placed. */
  const local = (v: Voice): number => time - v.cuedAt;
  const easeIds = new WeakMap<(u: number) => number, number>();
  let nextEase = 1;
  const easeKey = (f: (u: number) => number): number => {
    let k = easeIds.get(f);
    if (k == null) { k = nextEase++; easeIds.set(f, k); }
    return k;
  };
  const ms = new Map<number, number>();
  const springOf = new Map<number, SpringStart>();

  const reslot = (v: Voice): void => {
    v.ids = v.ids.slice();
    v.cols = { v: new Float64Array(v.ids.length * v.axes) };
    v.ids.forEach((id, i) => { subjects.get(id)!.slot = i; });
  };
  const join = (v: Voice, id: number): number => {
    v.ids.push(id);
    reslot(v);
    return v.ids.length - 1;
  };
  const leave = (v: Voice, id: number): void => {
    v.ids = v.ids.filter((x) => x !== id);
    reslot(v);
    if (v.solo && v.ids.length === 0) {
      v.handle.fade({ over: 0 });
      voices.delete(v.key);
    }
  };

  const tweenVoice = (ease: (u: number) => number, solo: string | null): Voice => {
    const key = solo ?? `tween:${easeKey(ease)}`;
    let v = voices.get(key);
    if (!v) {
      const patch = tweenPatch<number, Out, number[]>('v', {
        from: [0], to: [1], ms: (id) => ms.get(id)!, ease,
      });
      const m = mixOf(1);
      const handle = m.cue({ patch });
      v = { key, axes: 1, mix: m, cuedAt: time, handle, patch: patch as Voice['patch'], ids: [], cols: { v: new Float64Array(0) }, solo: solo != null };
      voices.set(key, v);
    }
    return v;
  };

  const springVoice = (s: SpringStart, solo: string | null): Voice => {
    const key = solo ?? `spring:${s.stiffness}:${s.damping}:${s.mass}:${s.to == null ? 'free' : 'held'}:${s.axes}`;
    let v = voices.get(key);
    if (!v) {
      const from = (id: number) => springOf.get(id)!.from;
      const velocity = (id: number) => springOf.get(id)!.velocity;
      // With no target the spring force is zero whatever the stiffness, leaving damping alone:
      // velocity falls as exp(-t * damping / mass), a glide whose time constant is mass / damping.
      const patch = s.to == null
        ? glide<number, Out, number[]>('v', { from, velocity, ms: (1000 * s.mass) / s.damping })
        : springPatch<number, Out, number[]>('v', {
          from, to: (id) => springOf.get(id)!.to ?? springOf.get(id)!.from,
          velocity, stiffness: s.stiffness, damping: s.damping, mass: s.mass,
        });
      const m = mixOf(s.axes);
      const handle = m.cue({ patch });
      v = { key, axes: s.axes, mix: m, cuedAt: time, handle, patch: patch as Voice['patch'], ids: [], cols: { v: new Float64Array(0) }, solo: solo != null };
      voices.set(key, v);
    }
    return v;
  };

  const get = (id: number): Subject => {
    const s = subjects.get(id);
    if (!s) throw new Error(`bank: no subject ${id}`);
    return s;
  };

  return {
    frame(dtMs) {
      time += dtMs;
      for (const v of voices.values()) {
        v.mix.sync(time);
        if (v.ids.length) v.mix.pull(v.ids, v.cols);
      }
    },
    tween(s) {
      ms.set(s.id, s.ms);
      const v = tweenVoice(s.ease, null);
      const sub: Subject = { voice: v, kind: 'tween', start: time, ms: s.ms, ease: s.ease, slot: 0 };
      subjects.set(s.id, sub);
      join(v, s.id);
      v.patch.to(s.id, [1], local(v));
    },
    spring(s) {
      springOf.set(s.id, s);
      const v = springVoice(s, null);
      const sub: Subject = { voice: v, kind: 'spring', start: time, ms: 0, ease: (u) => u, spring: s, slot: 0 };
      subjects.set(s.id, sub);
      join(v, s.id);
      if (s.to) v.patch.to(s.id, s.to, local(v));
    },
    progress(id) {
      const s = get(id);
      return s.voice.cols.v[s.slot]!;
    },
    motion(id) {
      const s = get(id);
      const m = s.voice.patch.read(id);
      if (!m) throw new Error(`bank: subject ${id} not read yet`);
      return { value: [m.value].flat(), velocity: [m.velocity].flat() };
    },
    retarget(id, to) {
      const s = get(id);
      s.spring!.to = to;
      if (to) s.voice.patch.to(id, to);
    },
    push(id, velocity) {
      get(id).voice.patch.push?.(id, velocity);
    },
    solo(id, rate) {
      const s = get(id);
      if (s.voice.solo) { s.voice.handle.rate = rate; return; }
      const from = s.voice;
      const key = `solo:${id}`;
      if (s.kind === 'tween') {
        const v = tweenVoice(s.ease, key);
        from.handle.fade({ subject: id, over: 0 });
        leave(from, id);
        s.voice = v;
        join(v, id);
        v.patch.to(id, [1], 0);
        v.handle.seek(time - s.start);
        v.handle.rate = rate;
      } else {
        const now = s.voice.patch.read(id)!;
        const sp = { ...s.spring!, from: [now.value].flat(), velocity: [now.velocity].flat() };
        springOf.set(id, sp);
        s.spring = sp;
        const v = springVoice(sp, key);
        from.handle.fade({ subject: id, over: 0 });
        leave(from, id);
        s.voice = v;
        join(v, id);
        if (sp.to) v.patch.to(id, sp.to, local(v));
        v.handle.rate = rate;
      }
    },
    stop(id) {
      const s = subjects.get(id);
      if (!s) return;
      s.voice.handle.fade({ subject: id, over: 0 });
      leave(s.voice, id);
      subjects.delete(id);
      ms.delete(id);
      springOf.delete(id);
    },
  };
}
```

Three things in this listing are guesses at blits' API that Task 1 did not pin. Check each against
`node_modules/@msb235/blits/dist/*.d.ts` before running, and correct the code, not the test:
`glide`'s options (`from`, `velocity`, `ms`), whether `fade({ over: 0 })` with no subject removes a
whole voice, and whether a voice cued on a mix synced to bank time `t` reads voice time 0 there.

- [ ] **Step 4: Run to see them pass**

Run: `npx vitest run --project=core packages/core/src/animation/engine/bank.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/engine/bank.ts packages/core/src/animation/engine/bank.test.ts
git commit -m "add the animator bank, which runs animation calls as subjects of shared blits voices"
```

### Task 4: Move today's integrator out of `useAnimator.ts`

`physics` keeps today's semi-implicit Euler for a `T` with no axes. Moving it to its own file first
keeps Task 6's diff about routing, not arithmetic.

**Files:**
- Create: `packages/core/src/animation/engine/integrator.ts`
- Modify: `packages/core/src/animation/useAnimator.ts:420-442`

- [ ] **Step 1: Create the module, with the step body copied unchanged from `useAnimator.ts:420-430`**

```ts
export interface VectorOps<T> {
  add(a: T, b: T): T;
  subtract(a: T, b: T): T;
  scale(v: T, k: number): T;
}

/** One semi-implicit Euler step of a damped spring toward `target`, or of pure damping when
 *  `target` is null. Returns the new value and velocity. */
export function stepSpring<T>(
  ops: VectorOps<T>,
  value: T, velocity: T, target: T | null,
  k: number, damping: number, mass: number, dt: number,
): { value: T; velocity: T } {
  const ref = target ?? value;
  const displacement = ops.subtract(value, ref);
  const springForce = ops.scale(displacement, target == null ? 0 : -k);
  const dampingForce = ops.scale(velocity, -damping);
  const accel = ops.scale(ops.add(springForce, dampingForce), 1 / mass);
  const v = ops.add(velocity, ops.scale(accel, dt));
  return { value: ops.add(value, ops.scale(v, dt)), velocity: v };
}
```

- [ ] **Step 2: Replace lines 422–430 of `useAnimator.ts` with a call**

```ts
          const next = stepSpring({ add, subtract, scale }, value, velocity, target, kBase, damping, mass, dt);
          value = next.value;
          velocity = next.velocity;
```

and add `import { stepSpring } from './engine/integrator';` beside the other imports.

- [ ] **Step 3: Run the animator's tests**

Run: `npx vitest run --project=core packages/core/src/animation/useAnimator.test.tsx`
Expected: 36 passed, as before the change.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/animation/engine/integrator.ts packages/core/src/animation/useAnimator.ts
git commit -m "move the animator's spring step into its own module"
```

### Task 5: Tweens through the bank

**Files:**
- Modify: `packages/core/src/animation/useAnimator.ts` (`tween`, `tickAll`, `register`'s handle)
- Test: `packages/core/src/animation/useAnimator.test.tsx`

This task changes where a tween's value is computed, not what it is: today's tween is already
`easing(elapsed / ms)` in closed form, so no test of behavior can fail before the change and pass
after it. The bank's own tests (Task 3) are the failing-first half. Here the 36 tests in
`useAnimator.test.tsx` are the guard, and the one new test pins the case the bank adds: two tweens
on one voice, one paused by its handle.

- [ ] **Step 1: Add the test**

```ts
describe('useAnimator on the bank', () => {
  it('pausing one tween leaves another with the same easing running', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    let a = 0;
    let b = 0;
    let ha: ReturnType<Animator['tween']>;
    act(() => {
      ha = result.current.tween<number>({ from: 0, to: 100, ms: 1000, easing: linear, onTick: (v) => { a = v; } });
      result.current.tween<number>({ from: 0, to: 100, ms: 1000, easing: linear, onTick: (v) => { b = v; } });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(200));
    act(() => ha.pause());
    act(() => clock.advance(300));
    expect(a).toBeCloseTo(20, 6);
    expect(b).toBeCloseTo(50, 6);
  });
});
```

- [ ] **Step 2: Run it on today's code**

Run: `npx vitest run --project=core packages/core/src/animation/useAnimator.test.tsx -t "on the bank"`
Expected: PASS. It describes behavior today already has; it stays green through Step 3.

- [ ] **Step 3: Route tweens through the bank**

In `useAnimator`, inside the `useMemo` factory, before `tickAll`:

```ts
    const bank = createBank();
```

Beside `tickDepth`, outside the memo so `onResume` can reach it:

```ts
  /** The frame timestamp the bank last advanced to. Null before the first frame and after the page
   *  was hidden, so neither gap is charged to the bank. */
  const bankFrameT = useRef<number | null>(null);
```

and in the `onResume` callback at `useAnimator.ts:93`, add `bankFrameT.current = null;`.

At the top of `tickAll`, before the per-animation loop, advance the bank by the frame's time at the
global rate:

```ts
      const frameDt = bankFrameT.current == null ? 0 : Math.max(0, t - bankFrameT.current);
      bankFrameT.current = t;
      bank.frame(frameDt * (globalPaused.current ? 0 : globalTimeScale.current));
```

A tween registered between frames starts at the bank time of the last frame, where today it starts
at `now()` when `tween` is called. The difference is at most one frame.

Replace the body of `tween`'s `tick` so it reads progress from the bank instead of computing it:

```ts
        tick(nowMs) {
          if (tripwire()) return true;
          const t = o.ms <= 0 ? 1 : Math.min(1, nowMs / o.ms);
          const eased = t >= 1 ? easing(1) : bank.progress(id);
          const value = factoryFn ? factoryFn(eased) : perTickInterp!(o.from, o.to, eased);
          o.onTick(value);
          if (t >= 1 && !lastValueEmitted) {
            lastValueEmitted = true;
            bank.stop(id);
            if (animations.current.has(id)) {
              reportEnd(id);
              o.onDone?.();
            }
            return true;
          }
          return false;
        },
```

and start the subject right after `register` returns, before the `return`:

```ts
      const handle = register({ /* unchanged seed, with the tick above */ });
      bank.tween({ id, ms: Math.max(o.ms, 1), ease: easing });
      return handle;
```

`nowMs` stays the call's own virtual time, which already folds in per-call pause and rate, so the
end of a tween is still decided where it is today. The bank decides only the value in between.

In `retire`, before `animations.current.delete(id)`, add `bank.stop(id);` so a cancel or interrupt
takes the subject off its voice. In `cancelAll`, call `bank.stop(a.id)` for each retired animation.

In `register`'s returned handle, a per-call pause or rate moves the call to its own voice:

```ts
        pause: () => { const a = animations.current.get(anim.id); if (a) { a.paused = true; bank.solo(anim.id, 0); } },
        resume: () => { const a = animations.current.get(anim.id); if (a) { a.paused = false; bank.solo(anim.id, a.timeScale); } },
        setTimeScale: (s) => { const a = animations.current.get(anim.id); if (a) { a.timeScale = s; bank.solo(anim.id, a.paused ? 0 : s); } },
```

Do the same in `pauseKey`, `resumeKey` and `setTimeScaleByKey`. `bank.solo` throws for an id with no
subject (a supervisor, a timeline); guard each call with a `has` check added to `Bank`:

```ts
  /** Whether `id` is one of the bank's subjects. */
  has(id: number): boolean;
```

implemented in `bank.ts` as `has: (id) => subjects.has(id),`.

- [ ] **Step 4: Run every animator test**

Run: `npx vitest run --project=core packages/core/src/animation/`
Expected: all pass. Tests that fail on a tween's value by a frame are reporting a real change in
when a tween starts; read the failure before touching the assertion, and record what changed in the
commit message.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/useAnimator.ts packages/core/src/animation/useAnimator.test.tsx packages/core/src/animation/engine/bank.ts
git commit -m "run animator tweens as subjects of shared blits voices"
```

### Task 6: Springs, physics and decay through the bank

**Files:**
- Modify: `packages/core/src/animation/useAnimator.ts` (`physics`)
- Modify: `packages/core/src/animation/useAnimator.test.tsx:541-650`

- [ ] **Step 1: Rewrite the parity tests to compare against the closed form**

The tests at `useAnimator.test.tsx:541` and `:568` assert that `physics` matches `spring` and an
exponential decay to 5 places under Euler. Under blits both are closed forms, so the same
comparison holds and gets tighter; keep them, and add one that fails until physics runs on the bank:

```ts
  it('a numeric spring lands where the closed form puts it, at any frame rate', () => {
    const run = (step: number): number => {
      const clock = makeClock();
      const { result } = renderHook(() => useAnimator(clock));
      let last = 0;
      act(() => { result.current.spring<number>({ from: 0, to: 100, stiffness: 170, damping: 26, mass: 1, onTick: (v) => { last = v; } }); });
      act(() => clock.advance(0));
      for (let t = 0; t < 300; t += step) act(() => clock.advance(step));
      return last;
    };
    expect(run(7)).toBeCloseTo(run(33), 6);
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run --project=core packages/core/src/animation/useAnimator.test.tsx -t "at any frame rate"`
Expected: FAIL. Euler at 7 ms and at 33 ms frames lands in different places.

- [ ] **Step 3: Route `physics` through the bank when `T` has axes**

At the top of `physics`, after the constants are resolved:

```ts
      const axes = axesOf(o.from);
      if (axes) {
        bank.spring({
          id, axes: axes.count,
          from: axes.to(o.from),
          to: o.to == null ? null : axes.to(o.to),
          velocity: o.velocity == null ? new Array(axes.count).fill(0) : axes.to(o.velocity),
          stiffness: kBase, damping, mass,
        });
      }
```

In `tick`, when `axes` is set, replace the Euler step with a read:

```ts
          const m = bank.motion(id);
          value = axes.from(m.value);
          velocity = axes.from(m.velocity);
          o.onTick(value);
```

keeping the rest check below it unchanged, with `bank.stop(id)` before `reportEnd(id)` when it
settles. When `axes` is null, the tick keeps the `stepSpring` call from Task 4.

`setTarget` and `setVelocity` on the handle become:

```ts
        setTarget: (newTo: T | null) => { target = newTo; if (axes) bank.retarget(id, newTo == null ? null : axes.to(newTo)); },
        setVelocity: (v: T) => { velocity = v; if (axes) bank.push(id, axes.to(v)); },
```

`bank.retarget(id, null)` on a held spring (the `setTarget(null)` test at `:622`) has to switch the
subject to free motion. If blits' `spring` cannot release a subject to coast, `retarget` moves the
subject to a `glide` voice from its current motion, the way `solo` moves it; write that branch in
`bank.ts` with a test in `bank.test.ts` first.

- [ ] **Step 4: Run every animator test**

Run: `npx vitest run --project=core packages/core/src/animation/`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/useAnimator.ts packages/core/src/animation/useAnimator.test.tsx packages/core/src/animation/engine/bank.ts packages/core/src/animation/engine/bank.test.ts
git commit -m "run animator springs, physics and decay on blits closed forms"
```

### Task 7: The cost, against today

**Files:**
- Modify: `tests/perf/bench/animator-on-blits.bench.ts`

- [ ] **Step 1: Make `today` mean the rebuilt animator**

The bench's `today` rows already call `useAnimator`, so they now measure the rebuilt animator. Add
nothing; the comparison is this branch against `main` on one machine.

- [ ] **Step 2: Run both on teitou, alternated**

Sync `main` and this branch as two trees and run the frame groups three times each, alternated, the
way `docs/proposals/2026-09-30-animator-on-blits.md` records its teitou table. Use the `onto-job`
skill; do not run it on this machine.

- [ ] **Step 3: Record the table in the proposal**

Replace the step 3 section's tables with one comparing `main`'s `today` to this branch's `today` at
1k and 10k, tween and spring. If 10k tweens cost more than 1.5× `main`, say so in the proposal's
status line; the approval was given at that figure.

- [ ] **Step 4: Commit**

```bash
git add docs/proposals/2026-09-30-animator-on-blits.md
git commit -m "measure the rebuilt animator against main"
```

### Task 8: Docs and changeset

- [ ] **Step 1: Proposal status.** In `docs/proposals/2026-09-30-animator-on-blits.md`, change the
status line to say steps 1–3 are built and step 3 leaves keyframe sampling for its own plan; cut
"What step 3 has to answer first" down to the decision and the final table.
- [ ] **Step 2: TODO.** Rewrite the "(P3) The animator on blits" entry in `docs/TODO.md` around what
is left: keyframe sampling, then steps 4–6.
- [ ] **Step 3: Changeset.** Create `.changeset/animator-on-blits.md`:

```md
---
"@weasel-js/core": patch
---

The animator computes tweens, springs, physics and decay in blits. Signatures are unchanged.
Springs, physics and decay now follow closed forms, so a spring lands in the same place at any frame
rate; values differ slightly from the previous integrator's.
```

- [ ] **Step 4: Commit**

```bash
git add docs/proposals/2026-09-30-animator-on-blits.md docs/TODO.md .changeset/animator-on-blits.md
git commit -m "record animator step 3 as built"
```

- [ ] **Step 5: Delete this plan** in the merge commit.
