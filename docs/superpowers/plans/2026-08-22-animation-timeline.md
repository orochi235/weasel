# Animation Timeline + Hierarchical Rig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyframe timeline primitive to the animator, plus a skeleton/pose rig that rides on it as an ordinary track.

**Architecture:** A timeline is a registered animator animation, not a new clock. `register(seed)` hands each entry's `tick` a `virtualNow` that the shared rAF loop advances by `realDt * scale`, so the timeline derives its playhead as `virtualNow + offset` and `seek` moves `offset`. That needs no new seam in the animator. Sampled tracks are a pure function of the playhead; event tracks are edge crossings that stay silent under seek; timeline tracks nest by evaluating children at `playhead - at`.

**Tech Stack:** TypeScript, React 19, vitest (jsdom, `--project=kit`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-animation-timeline-rig-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/animation/timeline/types.ts` | `Keyframe`, the three `Track` kinds, `TimelineOptions`, `TimelineHandle` |
| `packages/core/src/animation/timeline/sampleTrack.ts` | Pure: sample a `SampledTrack<T>` at a time |
| `packages/core/src/animation/timeline/createTimeline.ts` | The primitive: playhead, seek, loop, tracks, edit/subscribe |
| `packages/core/src/animation/timeline/index.ts` | Module barrel |
| `packages/core/src/animation/rig/types.ts` | `JointTransform`, `Joint`, `Skeleton`, `Pose` |
| `packages/core/src/animation/rig/blendPoses.ts` | Pure: weighted blend of poses |
| `packages/core/src/animation/rig/resolveSkeleton.ts` | Pure: compose local transforms into world `Mat3` |
| `packages/core/src/animation/rig/index.ts` | Module barrel |
| `packages/core/src/animation/types.ts` | Modify: add `timeline()` to `Animator` |
| `packages/core/src/animation/useAnimator.ts` | Modify: bind `timeline` |
| `packages/core/src/animation/index.ts` | Modify: re-export timeline + rig public surface |

Run tests with `npx vitest run --project=kit <path>`. Core's suite lives in the
`kit` project (`packages/core/src/**/*.test.ts`). Typecheck from the repo root
with `npx tsc --noEmit` — never the per-package config, which fails on a clean
tree (see Task 1).

`packages/core/src/animation/` is outside the eslint config's `files` scope, so
lint rules there are inert. The `eslint-disable` comment in Task 1's types and
the empty `onWrap` in Task 5 are harmless either way; leave them.

---

### Task 1: Timeline types

**Files:**
- Create: `packages/core/src/animation/timeline/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { AnimationHandle, EasingFn, Interpolate, InterpolatorFactory } from '../types';

/** One keyframe. `easing` shapes the approach INTO this key from the previous
 *  one, so the first key's easing is never consulted. */
export interface Keyframe<T> {
  /** Time within the track's timeline, in ms. */
  t: number;
  value: T;
  easing?: EasingFn;
}

/** A track sampled as a pure function of the playhead. Scrubbing one is free
 *  and order-independent. */
export interface SampledTrack<T> {
  kind: 'sampled';
  label?: string;
  /** Sorted ascending by `t`. `sampleTrack` assumes this and does not sort. */
  keys: Keyframe<T>[];
  /** Required when T is not `number`; defaults to numeric lerp otherwise. */
  interpolate?: Interpolate<T>;
  /** Built once per segment and cached. Takes precedence over `interpolate`. */
  interpolator?: InterpolatorFactory<T>;
  onTick: (value: T) => void;
}

/** A track of edge crossings. Fires only when the playhead advances forward
 *  under playback — never on `seek`. */
export interface EventTrack {
  kind: 'event';
  label?: string;
  /** Sorted ascending by `t`. */
  events: { t: number; fire: () => void }[];
}

/** A nested timeline, evaluated at `playhead - at`. Children are NOT registered
 *  with the animator separately; the parent evaluates them. */
export interface TimelineTrack {
  kind: 'timeline';
  label?: string;
  at: number;
  timeline: NestedTimeline;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Track = SampledTrack<any> | EventTrack | TimelineTrack;

/** What a child timeline may declare. The parent owns playback, so `loop`,
 *  `autoplay`, `onDone` and `cancelKey` have no meaning below the root. */
export interface NestedTimeline {
  tracks: Track[];
  /** Defaults to the largest end time across `tracks`. */
  duration?: number;
}

export interface TimelineOptions extends NestedTimeline {
  /** `true` loops forever, `n` loops n additional times. Default false. */
  loop?: boolean | number;
  /** Default true. When false the timeline registers but holds at t=0 until resumed. */
  autoplay?: boolean;
  onDone?: () => void;
  cancelKey?: string;
}

export interface TimelineHandle extends AnimationHandle {
  /** Move the playhead. Never fires event tracks, at any depth. */
  seek(t: number): void;
  /** Current playhead in ms. */
  time(): number;
  duration(): number;
  tracks(): readonly Track[];
  /** Run `fn`, then bump the version, recompute duration, and notify. Every
   *  mutation must go through this — cached interpolators key on the version. */
  edit(fn: () => void): void;
  /** Notified after each `edit`. Returns an unsubscribe. */
  subscribe(cb: () => void): () => void;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit` (from the repo root)
Expected: exit 0.

**Do not use `tsc --noEmit -p packages/core/tsconfig.json`.** It exits 1 with 31
pre-existing `TS6059` errors on a clean tree — that config sets `rootDir` to
`packages/core` while the program pulls in `packages/modes`. The root invocation
is the repo's canonical typecheck and the one `prepublishOnly` gates on.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/animation/timeline/types.ts
git commit -m "add timeline track and handle types"
```

---

### Task 2: Pure track sampling

**Files:**
- Create: `packages/core/src/animation/timeline/sampleTrack.ts`
- Test: `packages/core/src/animation/timeline/sampleTrack.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack } from './types';

const track = (keys: { t: number; value: number; easing?: (t: number) => number }[]): SampledTrack<number> => ({
  kind: 'sampled',
  keys,
  onTick: () => {},
});

describe('sampleTrack', () => {
  it('holds the first value before the first key', () => {
    expect(sampleTrack(track([{ t: 100, value: 5 }, { t: 200, value: 9 }]), 0)).toBe(5);
  });

  it('holds the last value after the last key', () => {
    expect(sampleTrack(track([{ t: 100, value: 5 }, { t: 200, value: 9 }]), 999)).toBe(9);
  });

  it('lerps linearly between two keys', () => {
    expect(sampleTrack(track([{ t: 0, value: 0 }, { t: 100, value: 10 }]), 50)).toBe(5);
  });

  it('applies the LATER key easing, not the earlier one', () => {
    const t = track([
      { t: 0, value: 0, easing: () => 0 },
      { t: 100, value: 10, easing: () => 1 },
    ]);
    expect(sampleTrack(t, 50)).toBe(10);
  });

  it('returns an exact key value at that key time', () => {
    expect(sampleTrack(track([{ t: 0, value: 3 }, { t: 100, value: 7 }]), 100)).toBe(7);
  });

  it('returns undefined for an empty track', () => {
    expect(sampleTrack(track([]), 10)).toBeUndefined();
  });

  it('uses a custom interpolate for non-numeric values', () => {
    const t: SampledTrack<string> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 'a' }, { t: 100, value: 'b' }],
      interpolate: (a, b, u) => (u < 0.5 ? a : b),
      onTick: () => {},
    };
    expect(sampleTrack(t, 10)).toBe('a');
    expect(sampleTrack(t, 90)).toBe('b');
  });

  it('builds an interpolator factory once per segment, not per sample', () => {
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const t: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 10 }],
      interpolator: build,
      onTick: () => {},
    };
    const cache = new Map<number, (u: number) => number>();
    sampleTrack(t, 10, cache);
    sampleTrack(t, 20, cache);
    sampleTrack(t, 30, cache);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('throws for non-numeric values with no interpolate', () => {
    const t = {
      kind: 'sampled',
      keys: [{ t: 0, value: 'a' }, { t: 100, value: 'b' }],
      onTick: () => {},
    } as unknown as SampledTrack<string>;
    expect(() => sampleTrack(t, 50)).toThrow(/interpolate/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/sampleTrack.test.ts`
Expected: FAIL — cannot resolve `./sampleTrack`.

- [ ] **Step 3: Write the implementation**

```ts
import type { SampledTrack } from './types';

/** Index of the last key at or before `t`, or -1 when `t` precedes all keys.
 *  Binary search: tracks are sorted and may be long. */
function floorKeyIndex<T>(keys: SampledTrack<T>['keys'], t: number): number {
  let lo = 0;
  let hi = keys.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].t <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/**
 * Sample a track at `t`. Pure: no state, no side effects, safe to call for any
 * `t` in any order — which is what makes scrubbing free.
 *
 * `segmentCache` memoizes `interpolator` factories by the index of the segment's
 * later key. Callers that mutate keys must drop the cache; `createTimeline`
 * drops it wholesale on `edit`.
 */
export function sampleTrack<T>(
  track: SampledTrack<T>,
  t: number,
  segmentCache?: Map<number, (u: number) => T>,
): T | undefined {
  const { keys } = track;
  if (keys.length === 0) return undefined;

  const i = floorKeyIndex(keys, t);
  if (i < 0) return keys[0].value;
  if (i >= keys.length - 1) return keys[keys.length - 1].value;

  const a = keys[i];
  const b = keys[i + 1];
  const span = b.t - a.t;
  const raw = span <= 0 ? 1 : (t - a.t) / span;
  // `easing` belongs to the key being approached, so `b` supplies it.
  const u = b.easing ? b.easing(raw) : raw;

  if (track.interpolator) {
    let fn = segmentCache?.get(i + 1);
    if (!fn) {
      fn = track.interpolator(a.value, b.value);
      segmentCache?.set(i + 1, fn);
    }
    return fn(u);
  }
  if (track.interpolate) return track.interpolate(a.value, b.value, u);

  if (typeof a.value === 'number' && typeof b.value === 'number') {
    return ((a.value as number) + ((b.value as number) - (a.value as number)) * u) as unknown as T;
  }
  throw new Error('sampleTrack: interpolate or interpolator is required for non-numeric keyframe values');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/sampleTrack.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/timeline/sampleTrack.ts packages/core/src/animation/timeline/sampleTrack.test.ts
git commit -m "sample a keyframe track as a pure function of time"
```

---

### Task 3: Timeline core — playhead, sampled tracks, completion

**Files:**
- Create: `packages/core/src/animation/timeline/createTimeline.ts`
- Test: `packages/core/src/animation/timeline/createTimeline.test.ts`

`createTimeline` takes the animator's internal `register` the way `createLoop` takes `createSupervisor`. Tests supply a fake `register` that captures the tick and drives it by hand — no React, no rAF.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack } from './types';

/** Fake register: captures the seed's tick so a test can drive virtual time. */
function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  let cancelled = false;
  let onCancel: (() => void) | undefined;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    onCancel = seed.onCancel;
    return {
      id: seed.id,
      cancel: () => { cancelled = true; onCancel?.(); },
      pause: () => {},
      resume: () => {},
      setTimeScale: () => {},
      isPaused: () => false,
    };
  };
  return {
    register,
    /** Advance virtual time to `t`; returns true when the timeline finished. */
    advance: (t: number) => tick!(t),
    isCancelled: () => cancelled,
  };
}

const numberTrack = (onTick: (v: number) => void): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

describe('createTimeline', () => {
  it('derives duration from the longest track', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    expect(tl.duration()).toBe(100);
  });

  it('honors an explicit duration over the derived one', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], duration: 500 });
    expect(tl.duration()).toBe(500);
  });

  it('drives onTick with the sampled value as virtual time advances', () => {
    const h = harness();
    const seen: number[] = [];
    createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(0);
    h.advance(50);
    expect(seen).toEqual([0, 50]);
  });

  it('reports the playhead through time()', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(42);
    expect(tl.time()).toBe(42);
  });

  it('finishes at duration and fires onDone exactly once', () => {
    const h = harness();
    const onDone = vi.fn();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], onDone });
    expect(h.advance(50)).toBe(false);
    expect(h.advance(100)).toBe(true);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('fires onDone once across repeated ticks past duration', () => {
    const h = harness();
    const onDone = vi.fn();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], onDone });
    h.advance(100);
    h.advance(140);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('clamps the final sample to duration rather than overshooting', () => {
    const h = harness();
    const seen: number[] = [];
    createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(180);
    expect(seen.at(-1)).toBe(100);
  });

  it('exposes its tracks for an editor to render', () => {
    const h = harness();
    const track = numberTrack(() => {});
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    expect(tl.tracks()).toEqual([track]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: FAIL — cannot resolve `./createTimeline`.

- [ ] **Step 3: Write the implementation**

```ts
import type { AnimationHandle } from '../types';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack, TimelineHandle, TimelineOptions, Track } from './types';

/** The animator's internal `register`, narrowed to what a timeline needs. */
export type TimelineRegister = (seed: {
  id: number;
  cancelKey?: string;
  tick: (virtualNow: number) => boolean;
  onCancel?: () => void;
}) => AnimationHandle;

/** End time of a track: its last key/event, or a nested timeline's own end. */
function trackEnd(track: Track): number {
  switch (track.kind) {
    case 'sampled': return track.keys.length ? track.keys[track.keys.length - 1].t : 0;
    case 'event': return track.events.length ? track.events[track.events.length - 1].t : 0;
    case 'timeline': return track.at + tracksEnd(track.timeline.tracks, track.timeline.duration);
  }
}

function tracksEnd(tracks: Track[], explicit?: number): number {
  if (explicit != null) return explicit;
  let max = 0;
  for (const t of tracks) max = Math.max(max, trackEnd(t));
  return max;
}

/**
 * Create a timeline as a registered animator animation.
 *
 * The playhead is NOT the entry's `virtualNow` directly — it is
 * `virtualNow + offset`, where `offset` is what `seek` and looping move. That
 * keeps seek and wrap-around entirely inside the timeline and needs no setter
 * on the animator's entry.
 */
export function createTimeline(
  register: TimelineRegister,
  id: number,
  opts: TimelineOptions,
): TimelineHandle {
  let duration = tracksEnd(opts.tracks, opts.duration);
  let offset = 0;
  let lastVirtual = 0;
  let playhead = 0;
  let done = false;

  // Per-sampled-track interpolator-factory caches, dropped wholesale by `edit`.
  let caches = new WeakMap<object, Map<number, (u: number) => unknown>>();
  const cacheFor = (track: object): Map<number, (u: number) => unknown> => {
    let c = caches.get(track);
    if (!c) { c = new Map(); caches.set(track, c); }
    return c;
  };

  const applySampled = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind !== 'sampled') continue;
      const st = track as SampledTrack<unknown>;
      const v = sampleTrack(st, t, cacheFor(st));
      if (v !== undefined) st.onTick(v);
    }
  };

  const base = register({
    id,
    cancelKey: opts.cancelKey,
    tick(virtualNow) {
      lastVirtual = virtualNow;
      playhead = virtualNow + offset;

      const finished = playhead >= duration;
      playhead = Math.min(playhead, duration);
      applySampled(opts.tracks, playhead);
      if (finished && !done) { done = true; opts.onDone?.(); }
      return finished;
    },
  });

  return {
    ...base,
    seek(t) {
      offset = t - lastVirtual;
      playhead = t;
    },
    time: () => playhead,
    duration: () => duration,
    tracks: () => opts.tracks,
    edit(fn) {
      fn();
      caches = new WeakMap();
      duration = tracksEnd(opts.tracks, opts.duration);
    },
    subscribe: () => () => {},
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/timeline/createTimeline.ts packages/core/src/animation/timeline/createTimeline.test.ts
git commit -m "drive sampled tracks from a registered timeline animation"
```

---

### Task 4: Seek

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.test.ts` (append)

`seek` already works from Task 3's offset. This task pins the behavior with tests before event tracks make it subtle.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('createTimeline', ...)`:

```ts
  it('moves the playhead without waiting for a tick', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(10);
    tl.seek(80);
    expect(tl.time()).toBe(80);
  });

  it('keeps the seeked position as virtual time keeps advancing', () => {
    const h = harness();
    const seen: number[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack((v) => seen.push(v))] });
    h.advance(10);
    tl.seek(80);
    h.advance(20);          // 10ms of real virtual time after the seek
    expect(seen.at(-1)).toBe(90);
  });

  it('seeks backward', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    h.advance(90);
    tl.seek(10);
    h.advance(95);
    expect(tl.time()).toBe(15);
  });
```

- [ ] **Step 2: Run to verify all three pass already**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: PASS, 11 tests. If "keeps the seeked position" fails, `offset` is being recomputed against the wrong baseline — `seek` must use the last `virtualNow` the tick saw, not the playhead.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/animation/timeline/createTimeline.test.ts
git commit -m "cover seek against the offset-derived playhead"
```

---

### Task 5: Looping

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.ts`
- Modify: `packages/core/src/animation/timeline/createTimeline.test.ts` (append)

- [ ] **Step 1: Write the failing test**

```ts
  it('wraps the playhead instead of finishing when looping', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: true });
    expect(h.advance(150)).toBe(false);
    expect(tl.time()).toBe(50);
  });

  it('stops after n additional loops', () => {
    const h = harness();
    const onDone = vi.fn();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: 1, onDone });
    expect(h.advance(150)).toBe(false);   // first wrap consumes the one loop
    expect(h.advance(260)).toBe(true);    // second pass ends
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('wraps repeatedly across a long jump', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], loop: true });
    h.advance(1020);
    expect(tl.time()).toBe(20);
  });

  it('terminates a zero-duration looping timeline instead of spinning', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [], loop: true });
    expect(h.advance(0)).toBe(true);
    expect(h.advance(100)).toBe(true);
    expect(tl.time()).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: FAIL — the first case returns `true` (finished) with `time()` of 100.

- [ ] **Step 3: Update the implementation**

Add a loop counter beside the other state:

```ts
  const loopOpt = opts.loop ?? false;
  let loopsLeft = loopOpt === true ? Infinity : loopOpt === false ? 0 : loopOpt;
```

Replace the `tick` body's overflow branch with:

```ts
    tick(virtualNow) {
      lastVirtual = virtualNow;
      playhead = virtualNow + offset;

      // A far seek can skip a billion laps of a short duration, so an endless
      // loop takes them in one modulo rather than one iteration each.
      if (duration > 0 && playhead >= duration) {
        if (loopsLeft === Infinity) {
          const laps = Math.floor(playhead / duration);
          offset -= laps * duration;
          playhead -= laps * duration;
          onWrap();
        } else {
          while (playhead >= duration && loopsLeft > 0) {
            loopsLeft -= 1;
            offset -= duration;
            playhead -= duration;
            onWrap();
          }
        }
      }

      const finished = playhead >= duration;
      playhead = Math.min(playhead, duration);

      applySampled(opts.tracks, playhead);

      if (finished && !done) { done = true; opts.onDone?.(); }
      return finished;
    },
```

`duration > 0` is what stops a zero-duration `loop: true` timeline from wedging
the tab: `loopsLeft` is `Infinity`, so without the guard the modulo is `0 / 0`.
Keep the per-lap `while` only where the lap count is finite and so bounded. The
modulo branch collapses every skipped lap into one `onWrap`, which Task 6 pins.

Add the wrap hook above `base` — it does nothing yet and gains a body in Task 6:

```ts
  const onWrap = (): void => {};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/timeline/createTimeline.ts packages/core/src/animation/timeline/createTimeline.test.ts
git commit -m "wrap a looping timeline across arbitrarily long advances"
```

---

### Task 5a: Honor `autoplay`, and drop the phantom "version"

`TimelineOptions.autoplay` is declared and documented in Task 1 but nothing
reads it. Shipping a public option that silently does nothing is a bug this repo
already has four instances of — see `docs/TODO.md` on `useHandTool`'s `inertia`
and `axis`, `useLassoTool`'s `mode`, and `Tool.onActivate`. Do not add a fifth.

Separately, Task 1's `edit` docstring promises a "version" that no task creates;
invalidation actually drops the whole cache. Fix the words to match the code.

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.ts`
- Modify: `packages/core/src/animation/timeline/types.ts`
- Modify: `packages/core/src/animation/timeline/createTimeline.test.ts` (harness + append)

- [ ] **Step 1: Teach the test harness to record pause state**

In `createTimeline.test.ts`, the `harness()` helper currently has `pause: () => {}`.
Pausing is the animator's job — it stops advancing `virtualNow` — so at this
level the only thing to assert is that `createTimeline` asked. Replace the
handle stub inside `harness()`'s `register` with:

```ts
  let paused = false;
```

added beside `let cancelled = false;`, and change the returned handle's `pause`
and `isPaused`:

```ts
      pause: () => { paused = true; },
      resume: () => { paused = false; },
      isPaused: () => paused,
```

then expose it from `harness()`'s return object alongside `isCancelled`:

```ts
    isPaused: () => paused,
```

- [ ] **Step 2: Write the failing test**

Append inside `describe('createTimeline', ...)`:

```ts
  it('plays on its own by default', () => {
    const h = harness();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})] });
    expect(h.isPaused()).toBe(false);
  });

  it('registers paused when autoplay is false', () => {
    const h = harness();
    createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], autoplay: false });
    expect(h.isPaused()).toBe(true);
  });

  it('is resumable through the returned handle', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [numberTrack(() => {})], autoplay: false });
    tl.resume();
    expect(h.isPaused()).toBe(false);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: FAIL on "registers paused when autoplay is false" — `expected false to be true`.
The other two should already pass.

- [ ] **Step 4: Implement**

In `createTimeline.ts`, immediately after the `const base = register({ ... });`
call and before the `return {` statement, add:

```ts
  // A paused entry's scale is zero, so `virtualNow` never advances and the
  // playhead holds at 0 until the consumer resumes.
  if (opts.autoplay === false) base.pause();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/createTimeline.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 6: Fix the stale docstring**

In `types.ts`, replace the `edit` doc comment:

```ts
  /** Run `fn`, then bump the version, recompute duration, and notify. Every
   *  mutation must go through this — cached interpolators key on the version. */
  edit(fn: () => void): void;
```

with:

```ts
  /** Run `fn`, then recompute duration, drop cached interpolators, and notify.
   *  Every mutation must go through this — an edited keyframe otherwise keeps
   *  interpolating toward its old value with no visible error. */
  edit(fn: () => void): void;
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npx vitest run --project=kit packages/core/src/animation/timeline/`
Expected: exit 0, 27 tests passing.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/animation/timeline/
git commit -m "honor autoplay instead of declaring it and ignoring it"
```

---

### Task 6: Event tracks

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.ts`
- Test: `packages/core/src/animation/timeline/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { EventTrack } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const eventTrack = (fire: (label: string) => void): EventTrack => ({
  kind: 'event',
  events: [
    { t: 10, fire: () => fire('a') },
    { t: 50, fire: () => fire('b') },
    { t: 90, fire: () => fire('c') },
  ],
});

describe('event tracks', () => {
  it('fires an event keyed at t=0 on the very first tick', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      tracks: [{ kind: 'event', events: [{ t: 0, fire: () => fired.push('zero') }] }],
    });
    h.advance(0);
    expect(fired).toEqual(['zero']);
  });

  it('fires each event once as the playhead crosses it', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(20);
    h.advance(60);
    expect(fired).toEqual(['a', 'b']);
  });

  it('does not re-fire an event already crossed', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(20);
    h.advance(21);
    h.advance(22);
    expect(fired).toEqual(['a']);
  });

  it('fires every event inside one long advance, in order', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(95);
    expect(fired).toEqual(['a', 'b', 'c']);
  });

  it('stays silent on seek', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(5);
    tl.seek(95);
    expect(fired).toEqual([]);
  });

  it('does not replay earlier events after seeking forward past them', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    tl.seek(60);
    h.advance(95);
    expect(fired).toEqual(['c']);
  });

  it('re-arms events after seeking backward', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, { tracks: [eventTrack((l) => fired.push(l))], duration: 100 });
    h.advance(95);
    fired.length = 0;
    tl.seek(0);
    // `advance` takes ABSOLUTE virtual time. `seek(0)` rebased offset to -95,
    // so 190 puts the playhead at 95 — advancing to 115 would leave it at 20
    // and only 'a' could ever fire.
    h.advance(190);
    expect(fired).toEqual(['a', 'b', 'c']);
  });

  it('fires an event in the tail of a pass straddling the loop seam', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      loop: true,
      tracks: [{ kind: 'event', events: [{ t: 98, fire: () => fired.push('late') }] }],
    });
    h.advance(95);
    h.advance(150);
    expect(fired).toEqual(['late']);
  });

  it('re-arms events on a loop wrap', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      tracks: [eventTrack((l) => fired.push(l))], duration: 100, loop: true,
    });
    h.advance(95);
    h.advance(195);
    expect(fired).toEqual(['a', 'b', 'c', 'a', 'b', 'c']);
  });

  it('never fires an event past the declared duration', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      tracks: [{ kind: 'event', events: [{ t: 150, fire: () => fired.push('past') }] }],
    });
    h.advance(200);
    expect(fired).toEqual([]);
  });

  it('does not replay a whole pass per lap skipped inside one frame', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      loop: true,
      tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }],
    });
    h.advance(60);
    h.advance(1060);
    expect(fired).toEqual(['x', 'x']);
  });
});
```

Append one more to `describe('createTimeline', ...)` in `createTimeline.test.ts`
— tick order is only observable once both track kinds exist:

```ts
  it('samples before firing, so a handler reads the current frame', () => {
    const h = harness();
    let current = -1;
    const seen: number[] = [];
    createTimeline(h.register, 1, {
      duration: 100,
      tracks: [
        numberTrack((v) => { current = v; }),
        { kind: 'event', events: [{ t: 50, fire: () => seen.push(current) }] },
      ],
    });
    h.advance(0);
    h.advance(50);
    expect(seen).toEqual([50]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/events.test.ts`
Expected: FAIL — nothing fires; event tracks are ignored by the tick.

- [ ] **Step 3: Update the implementation**

**One fire-once mechanism, not two.** Events fire on the half-open window
`(from, to]` and nothing else — no per-track cursor. A cursor is a second copy
of "where have we fired up to" that has to be re-synchronized at every site
that moves the playhead or edits a track, and the site that gets missed is
`edit`: deleting an event ahead of a cursor strands it past the end of a
now-shorter array and every later event silently stops firing. The window is
stateless per track, so it is correct under `edit` with no invalidation step at
all.

Add the bound search beside `trackEnd` at module level, and import `EventTrack`
from `./types`:

```ts
/** Index of the first event after `t`. Binary search: tracks may be long. */
function firstAfter(events: EventTrack['events'], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t > t) hi = mid; else lo = mid + 1;
  }
  return lo;
}
```

Then the firing pass, inside `createTimeline`:

```ts
  const fireEvents = (tracks: Track[], from: number, to: number): void => {
    for (const track of tracks) {
      if (track.kind !== 'event') continue;
      const end = firstAfter(track.events, to);
      for (let i = firstAfter(track.events, from); i < end; i += 1) track.events[i].fire();
    }
  };
```

Give the wrap hook a body. It must flush the outgoing pass's tail BEFORE
re-arming, and reset `prevPlayhead` after:

```ts
  // Flush the outgoing pass's tail before re-arming, or an event between the
  // last tick and `duration` is dropped whenever a frame straddles the seam.
  const onWrap = (): void => {
    fireEvents(opts.tracks, prevPlayhead, duration);
    prevPlayhead = -Infinity;
  };
```

Track the previous playhead and fire in the tick. Add
`let prevPlayhead = -Infinity;` beside the other state — seeding it to `0`
instead would silently swallow an event keyed at `t: 0`, since the window is
half-open at `from`. Then replace the tick's single `applySampled` line with:

```ts
      // Sampled before fired, so a handler reads the current frame's values.
      applySampled(opts.tracks, playhead);
      fireEvents(opts.tracks, prevPlayhead, playhead);
      prevPlayhead = playhead;
```

`playhead` was clamped by `Math.min(playhead, duration)` on the line above, so
that clamp is what keeps an event past an explicit `duration` from firing and
what keeps `prevPlayhead` from running a frame ahead of the declared end.

And in `seek`, move the mark without firing:

```ts
    seek(t) {
      offset = t - lastVirtual;
      playhead = t;
      prevPlayhead = t;
    },
```

There is nothing to invalidate below the root either: a child's window is the
parent's rebased by `- at` in Task 7, so `seek` stays silent at any depth
without recursing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/events.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole timeline suite for regressions**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/`
Expected: PASS, 39 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/animation/timeline/
git commit -m "fire event tracks on forward playback only, never on seek"
```

---

### Task 7: Nested timelines

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.ts`
- Test: `packages/core/src/animation/timeline/nesting.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack, TimelineTrack } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const ramp = (onTick: (v: number) => void): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

describe('nested timelines', () => {
  it('evaluates a child at playhead minus its offset', () => {
    const h = harness();
    const seen: number[] = [];
    const child: TimelineTrack = {
      kind: 'timeline',
      at: 200,
      timeline: { tracks: [ramp((v) => seen.push(v))] },
    };
    createTimeline(h.register, 1, { tracks: [child] });
    h.advance(250);
    expect(seen.at(-1)).toBe(50);
  });

  it('includes a child offset in the derived duration', () => {
    const h = harness();
    const child: TimelineTrack = {
      kind: 'timeline', at: 200, timeline: { tracks: [ramp(() => {})] },
    };
    const tl = createTimeline(h.register, 1, { tracks: [child] });
    expect(tl.duration()).toBe(300);
  });

  it('sequences two children placed at different offsets', () => {
    const h = harness();
    const a: number[] = [];
    const b: number[] = [];
    createTimeline(h.register, 1, {
      tracks: [
        { kind: 'timeline', at: 0, timeline: { tracks: [ramp((v) => a.push(v))] } },
        { kind: 'timeline', at: 100, timeline: { tracks: [ramp((v) => b.push(v))] } },
      ],
    });
    h.advance(150);
    expect(a.at(-1)).toBe(100);   // clamped past its end
    expect(b.at(-1)).toBe(50);
  });

  it('fires a child event track on forward playback', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }] },
      }],
    });
    h.advance(200);
    expect(fired).toEqual(['x']);
  });

  it('keeps a child event track silent under seek', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }] },
      }],
    });
    tl.seek(300);
    expect(fired).toEqual([]);
  });

  it('rebases a child event onto the parent clock', () => {
    const h = harness();
    const fired: string[] = [];
    createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 50, fire: () => fired.push('x') }] }] },
      }],
    });
    h.advance(60);
    expect(fired).toEqual([]);
    h.advance(160);
    expect(fired).toEqual(['x']);
  });

  it('rebases a seek onto the child clock', () => {
    const h = harness();
    const fired: string[] = [];
    const tl = createTimeline(h.register, 1, {
      duration: 400,
      tracks: [{
        kind: 'timeline',
        at: 100,
        timeline: { tracks: [{ kind: 'event', events: [{ t: 250, fire: () => fired.push('x') }] }] },
      }],
    });
    tl.seek(300);
    expect(fired).toEqual([]);
    h.advance(50);
    expect(fired).toEqual(['x']);
  });

  it('rejects parent-only options on a nested child', () => {
    const child: TimelineTrack = {
      kind: 'timeline',
      at: 0,
      // @ts-expect-error a child is a NestedTimeline: tracks and duration only.
      timeline: { tracks: [], loop: true },
    };
    expect(child.at).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/nesting.test.ts`
Expected: FAIL — timeline tracks are skipped; `seen` is empty.

- [ ] **Step 3: Update the implementation**

Make both walkers recurse. Replace `applySampled` and `fireEvents` with:

```ts
  const applySampled = (tracks: Track[], t: number): void => {
    for (const track of tracks) {
      if (track.kind === 'sampled') {
        const st = track as SampledTrack<unknown>;
        const v = sampleTrack(st, t, cacheFor(st));
        if (v !== undefined) st.onTick(v);
      } else if (track.kind === 'timeline') {
        applySampled(track.timeline.tracks, t - track.at);
      }
    }
  };

  const fireEvents = (tracks: Track[], from: number, to: number): void => {
    for (const track of tracks) {
      if (track.kind === 'event') {
        const end = firstAfter(track.events, to);
        for (let i = firstAfter(track.events, from); i < end; i += 1) track.events[i].fire();
      } else if (track.kind === 'timeline') {
        fireEvents(track.timeline.tracks, from - track.at, to - track.at);
      }
    }
  };
```

The `- track.at` rebase is the whole of nesting, and it is the only place a
child's clock is derived — sampling in one walker, events in the other. Both
directions of the event rebase are pinned below: an event must not fire early
at the child's own `t`, and a `seek` must land the child on `t - at` so a later
child event is not swallowed on the next forward tick.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/nesting.test.ts`
Expected: PASS, 8 tests. The `@ts-expect-error` case is a typecheck assertion —
run `npx tsc --noEmit` too, and if it reports an unused directive then
`TimelineTrack.timeline` is still typed `TimelineOptions` and a child is
silently accepting four options the evaluator never reads.

- [ ] **Step 5: Run the whole timeline suite**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/`
Expected: PASS, 47 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/animation/timeline/
git commit -m "evaluate nested timeline tracks at an offset playhead"
```

---

### Task 8: edit() and subscribe()

**Files:**
- Modify: `packages/core/src/animation/timeline/createTimeline.ts`
- Test: `packages/core/src/animation/timeline/edit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createTimeline, type TimelineRegister } from './createTimeline';
import type { EventTrack, SampledTrack } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

describe('timeline editing', () => {
  it('notifies subscribers after an edit', () => {
    const h = harness();
    const track: SampledTrack<number> = { kind: 'sampled', keys: [{ t: 0, value: 0 }], onTick: () => {} };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    const cb = vi.fn();
    tl.subscribe(cb);
    tl.edit(() => { track.keys.push({ t: 100, value: 5 }); });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after unsubscribe', () => {
    const h = harness();
    const tl = createTimeline(h.register, 1, { tracks: [] });
    const cb = vi.fn();
    const off = tl.subscribe(cb);
    off();
    tl.edit(() => {});
    expect(cb).not.toHaveBeenCalled();
  });

  it('recomputes duration after an edit', () => {
    const h = harness();
    const track: SampledTrack<number> = { kind: 'sampled', keys: [{ t: 0, value: 0 }], onTick: () => {} };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    expect(tl.duration()).toBe(0);
    tl.edit(() => { track.keys.push({ t: 250, value: 5 }); });
    expect(tl.duration()).toBe(250);
  });

  it('drops the interpolator cache so an edited key takes effect', () => {
    const h = harness();
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const seen: number[] = [];
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      interpolator: build,
      onTick: (v) => seen.push(v),
    };
    createTimeline(h.register, 1, { tracks: [track] });
    const tl = createTimeline(h.register, 2, { tracks: [track] });
    h.advance(50);
    expect(seen.at(-1)).toBe(50);

    tl.edit(() => { track.keys[1].value = 1000; });
    h.advance(50);
    expect(seen.at(-1)).toBe(500);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('keeps firing later events after an edit deletes an earlier one', () => {
    const h = harness();
    const fired: string[] = [];
    const track: EventTrack = {
      kind: 'event',
      events: [
        { t: 10, fire: () => fired.push('a') },
        { t: 50, fire: () => fired.push('b') },
        { t: 90, fire: () => fired.push('c') },
      ],
    };
    const tl = createTimeline(h.register, 1, { tracks: [track], duration: 200 });
    h.advance(60);
    tl.edit(() => { track.events.shift(); });
    h.advance(150);
    expect(fired).toEqual(['a', 'b', 'c']);
  });

  it('clamps the fired-through mark to duration so an extension still fires', () => {
    const h = harness();
    const fired: string[] = [];
    const track: EventTrack = {
      kind: 'event',
      events: [
        { t: 10, fire: () => fired.push('a') },
        { t: 50, fire: () => fired.push('b') },
      ],
    };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.advance(60);
    expect(fired).toEqual(['a', 'b']);
    tl.edit(() => { track.events.push({ t: 55, fire: () => fired.push('c') }); });
    h.advance(70);
    expect(fired).toEqual(['a', 'b', 'c']);
  });
});
```

The two event cases pass with no extra work in `edit` — that is the point of
firing on a searched window rather than a cursor. If either fails, event state
has crept back into the tracks and `edit` has become a fourth site that has to
know about it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/edit.test.ts`
Expected: FAIL — `subscribe` returns a no-op unsubscribe and never calls back.

- [ ] **Step 3: Update the implementation**

Add the subscriber set beside the other state:

```ts
  const subscribers = new Set<() => void>();
```

Replace `edit` and `subscribe` on the returned handle:

```ts
    edit(fn) {
      fn();
      caches = new WeakMap();
      duration = tracksEnd(opts.tracks, opts.duration);
      for (const cb of subscribers) {
        try { cb(); } catch (err) { console.error('timeline: subscriber threw', err); }
      }
    },
    subscribe(cb) {
      subscribers.add(cb);
      return () => { subscribers.delete(cb); };
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/edit.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/timeline/
git commit -m "notify subscribers and drop interpolator caches on timeline edit"
```

---

### Task 9: Bind `timeline` onto the animator

**Files:**
- Create: `packages/core/src/animation/timeline/index.ts`
- Modify: `packages/core/src/animation/types.ts`
- Modify: `packages/core/src/animation/useAnimator.ts`
- Modify: `packages/core/src/animation/index.ts`
- Test: `packages/core/src/animation/timeline/useAnimator.timeline.test.ts`

- [ ] **Step 1: Write the module barrel**

```ts
// packages/core/src/animation/timeline/index.ts
export { createTimeline, type TimelineRegister } from './createTimeline';
export { sampleTrack } from './sampleTrack';
export type {
  EventTrack,
  Keyframe,
  NestedTimeline,
  SampledTrack,
  TimelineHandle,
  TimelineOptions,
  TimelineTrack,
  Track,
} from './types';
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import type { SampledTrack } from './types';

/** Manual frame pump so the test owns virtual time. */
function pump() {
  const cbs: ((t: number) => void)[] = [];
  return {
    requestFrame: (cb: (t: number) => void) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => 0,
    frame: (t: number) => { const batch = cbs.splice(0); for (const cb of batch) cb(t); },
  };
}

describe('animator.timeline', () => {
  it('registers a timeline and drives its tracks', () => {
    const p = pump();
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      onTick: (v) => seen.push(v),
    };
    act(() => { result.current.timeline({ tracks: [track] }); });
    act(() => { p.frame(50); });
    expect(seen.at(-1)).toBe(50);
  });

  it('is cancellable by key like any other animation', () => {
    const p = pump();
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    act(() => { result.current.timeline({ tracks: [], duration: 1000, cancelKey: 'intro' }); });
    expect(result.current.isActive('intro')).toBe(true);
    act(() => { result.current.cancelKey('intro'); });
    expect(result.current.isActive('intro')).toBe(false);
  });

  it('freezes when the animator is globally paused', () => {
    const p = pump();
    const seen: number[] = [];
    const { result } = renderHook(() =>
      useAnimator({ requestFrame: p.requestFrame, cancelFrame: p.cancelFrame, now: p.now }),
    );
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      onTick: (v) => seen.push(v),
    };
    act(() => { result.current.timeline({ tracks: [track] }); });
    act(() => { p.frame(20); });
    act(() => { result.current.pause(); });
    act(() => { p.frame(80); });
    expect(seen.at(-1)).toBe(20);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/useAnimator.timeline.test.ts`
Expected: FAIL — `result.current.timeline is not a function`.

- [ ] **Step 4: Add `timeline` to the `Animator` interface**

In `packages/core/src/animation/types.ts`, add the import at the top:

```ts
import type { TimelineHandle, TimelineOptions } from './timeline/types';
```

and this member to `interface Animator`, directly after `stagger`'s declarations:

```ts
  /**
   * Keyframe timeline. Registered like any other animation, so its playhead
   * responds to `pause`, `setTimeScale` and `cancelKey`. Sampled tracks are a
   * pure function of the playhead; event tracks fire only on forward playback.
   */
  timeline(opts: TimelineOptions): TimelineHandle;
```

- [ ] **Step 5: Bind it in `useAnimator`**

In `packages/core/src/animation/useAnimator.ts`, add the import:

```ts
import { createTimeline } from './timeline/createTimeline';
```

and add this to the object returned from the `useMemo`, alongside `tween` / `loop` / `stagger`:

```ts
    timeline: (o: TimelineOptions) => createTimeline(register, nextId.current++, o),
```

Import the option type at the top:

```ts
import type { TimelineOptions } from './timeline/types';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/useAnimator.timeline.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Export from the animation barrel**

Append to `packages/core/src/animation/index.ts`:

```ts
export { sampleTrack } from './timeline';
export type {
  EventTrack,
  Keyframe,
  NestedTimeline,
  SampledTrack,
  TimelineHandle,
  TimelineOptions,
  TimelineTrack,
  Track,
} from './timeline';
```

`createTimeline` is deliberately NOT exported — like `createLoop` and `createStagger`, it takes the internal `register` seam and is reachable only through `animator.timeline`.

- [ ] **Step 8: Typecheck and run the full core suite**

Run: `npx tsc --noEmit && npx vitest run --project=kit`
Expected: exit 0, and the whole kit suite green.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/animation/
git commit -m "expose timeline as an animator primitive"
```

---

### Task 10: Rig types and `blendPoses`

**Files:**
- Create: `packages/core/src/animation/rig/types.ts`
- Create: `packages/core/src/animation/rig/blendPoses.ts`
- Test: `packages/core/src/animation/rig/blendPoses.test.ts`

- [ ] **Step 1: Write the types**

```ts
// packages/core/src/animation/rig/types.ts

/** A joint's local transform. Deliberately NOT the scene's generic `TPose`:
 *  `TPose` is consumer-defined and may be a bare AABB with no rotation term,
 *  which a joint chain cannot compose through. */
export interface JointTransform {
  x: number;
  y: number;
  /** Radians. */
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Joint {
  name: string;
  /** Parent joint name, or null for a root. */
  parent: string | null;
  /** Local transform at rest. */
  bind: JointTransform;
}

/** Joints in topological order: every joint appears after its parent. */
export interface Skeleton {
  joints: Joint[];
}

/** Local deltas from the bind pose, keyed by joint name. Absent joints and
 *  absent fields mean "no change from bind". */
export type Pose = Record<string, Partial<JointTransform>>;

export const IDENTITY_JOINT: JointTransform = {
  x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1,
};
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { blendPoses } from './blendPoses';
import type { Pose } from './types';

describe('blendPoses', () => {
  it('returns an empty pose for no inputs', () => {
    expect(blendPoses([], [])).toEqual({});
  });

  it('returns the single pose unchanged at weight 1', () => {
    const p: Pose = { hip: { x: 10, rotation: 0.5 } };
    expect(blendPoses([p], [1])).toEqual({ hip: { x: 10, rotation: 0.5 } });
  });

  it('averages two poses at equal weights', () => {
    const a: Pose = { hip: { x: 0 } };
    const b: Pose = { hip: { x: 10 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.x).toBe(5);
  });

  it('normalizes weights that do not sum to 1', () => {
    const a: Pose = { hip: { x: 0 } };
    const b: Pose = { hip: { x: 10 } };
    expect(blendPoses([a, b], [1, 1]).hip.x).toBe(5);
  });

  it('unions joints across poses, treating an absent joint as bind', () => {
    const a: Pose = { hip: { x: 10 } };
    const b: Pose = { knee: { x: 20 } };
    const out = blendPoses([a, b], [0.5, 0.5]);
    expect(out.hip!.x).toBe(5);
    expect(out.knee!.x).toBe(10);
  });

  it('treats an absent field as its identity, not as zero for scale', () => {
    const a: Pose = { hip: { scaleX: 3 } };
    const b: Pose = { hip: { x: 4 } };
    const out = blendPoses([a, b], [0.5, 0.5]);
    expect(out.hip!.scaleX).toBe(2);   // (3 + 1) / 2
    expect(out.hip!.x).toBe(2);        // (0 + 4) / 2
  });

  it('blends rotation the short way around the circle', () => {
    const a: Pose = { hip: { rotation: 0.1 } };
    const b: Pose = { hip: { rotation: Math.PI * 2 - 0.1 } };
    expect(blendPoses([a, b], [0.5, 0.5]).hip!.rotation).toBeCloseTo(0, 6);
  });

  it('throws when the weight count does not match the pose count', () => {
    expect(() => blendPoses([{}, {}], [1])).toThrow(/weights/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/blendPoses.test.ts`
Expected: FAIL — cannot resolve `./blendPoses`.

- [ ] **Step 4: Write the implementation**

```ts
import { IDENTITY_JOINT, type JointTransform, type Pose } from './types';

const TAU = Math.PI * 2;

/** Shortest signed angular delta from `a` to `b`, in (-PI, PI]. */
function shortestDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

const FIELDS: (keyof JointTransform)[] = ['x', 'y', 'scaleX', 'scaleY'];

/**
 * Weighted blend of poses. Weights are normalized, so `[1, 1]` means an even
 * mix. A joint absent from a pose contributes its identity delta, and a field
 * absent from a joint contributes that field's identity — 0 for translation and
 * rotation, 1 for scale. Blending scale toward 0 for an absent field would
 * collapse the joint, which is the bug this avoids.
 *
 * Rotation blends the short way around the circle, so 0.1 and TAU-0.1 average
 * to 0 rather than to PI.
 *
 * This doubles as the interpolator for a `SampledTrack<Pose>`: interpolating
 * between two poses at `u` is `blendPoses([a, b], [1 - u, u])`.
 */
export function blendPoses(poses: Pose[], weights: number[]): Pose {
  if (poses.length !== weights.length) {
    throw new Error('blendPoses: poses and weights must have the same length');
  }
  if (poses.length === 0) return {};

  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) return {};
  const norm = weights.map((w) => w / total);

  const names = new Set<string>();
  for (const p of poses) for (const k of Object.keys(p)) names.add(k);

  const out: Pose = {};
  for (const name of names) {
    const joint: Partial<JointTransform> = {};

    for (const field of FIELDS) {
      let acc = 0;
      for (let i = 0; i < poses.length; i += 1) {
        const v = poses[i][name]?.[field];
        acc += (v ?? IDENTITY_JOINT[field]) * norm[i];
      }
      joint[field] = acc;
    }

    // Rotation accumulates as a delta from the first pose's value so wrapping
    // is handled once, against a fixed reference.
    const base = poses[0][name]?.rotation ?? 0;
    let rot = 0;
    for (let i = 0; i < poses.length; i += 1) {
      const v = poses[i][name]?.rotation ?? 0;
      rot += shortestDelta(base, v) * norm[i];
    }
    joint.rotation = base + rot;

    out[name] = joint;
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/blendPoses.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/animation/rig/
git commit -m "blend poses by normalized weight with short-way rotation"
```

---

### Task 11: `resolveSkeleton`

**Files:**
- Create: `packages/core/src/animation/rig/resolveSkeleton.ts`
- Test: `packages/core/src/animation/rig/resolveSkeleton.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { resolveSkeleton } from './resolveSkeleton';
import { IDENTITY_JOINT, type Skeleton } from './types';
import { mat3 } from '../../renderer/math/mat3';

const j = (name: string, parent: string | null, x = 0, y = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y },
});

const apply = mat3.apply;

describe('resolveSkeleton', () => {
  it('returns the bind translation for a root joint at rest', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 20)] };
    const out = resolveSkeleton(skel, {});
    expect(apply(out.get('hip')!, 0, 0)).toEqual([10, 20]);
  });

  it('composes a child onto its parent', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 0), j('knee', 'hip', 5, 0)] };
    const out = resolveSkeleton(skel, {});
    expect(apply(out.get('knee')!, 0, 0)).toEqual([15, 0]);
  });

  it('applies a pose delta on top of bind', () => {
    const skel: Skeleton = { joints: [j('hip', null, 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { x: 5 } });
    expect(apply(out.get('hip')!, 0, 0)).toEqual([15, 0]);
  });

  it('propagates a parent rotation to a child position', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 0), j('knee', 'hip', 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { rotation: Math.PI / 2 } });
    const [x, y] = apply(out.get('knee')!, 0, 0);
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(10, 5);
  });

  it('multiplies a parent scale into a child offset', () => {
    const skel: Skeleton = { joints: [j('hip', null, 0, 0), j('knee', 'hip', 10, 0)] };
    const out = resolveSkeleton(skel, { hip: { scaleX: 2 } });
    expect(apply(out.get('knee')!, 0, 0)[0]).toBeCloseTo(20, 5);
  });

  it('resolves every joint in the skeleton', () => {
    const skel: Skeleton = { joints: [j('a', null), j('b', 'a'), j('c', 'b')] };
    expect([...resolveSkeleton(skel, {}).keys()]).toEqual(['a', 'b', 'c']);
  });

  it('throws when a joint names a parent that has not been resolved yet', () => {
    const skel: Skeleton = { joints: [j('knee', 'hip'), j('hip', null)] };
    expect(() => resolveSkeleton(skel, {})).toThrow(/topological|parent/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/resolveSkeleton.test.ts`
Expected: FAIL — cannot resolve `./resolveSkeleton`.

- [ ] **Step 3: Write the implementation**

```ts
import { mat3, type Mat3 } from '../../renderer/math/mat3';
import type { JointTransform, Pose, Skeleton } from './types';

/** bind + delta, field by field. Scale is multiplicative, the rest additive. */
function compose(bind: JointTransform, delta: Partial<JointTransform> | undefined): JointTransform {
  if (!delta) return bind;
  return {
    x: bind.x + (delta.x ?? 0),
    y: bind.y + (delta.y ?? 0),
    rotation: bind.rotation + (delta.rotation ?? 0),
    scaleX: bind.scaleX * (delta.scaleX ?? 1),
    scaleY: bind.scaleY * (delta.scaleY ?? 1),
  };
}

/** TRS as a Mat3: translate * rotate * scale, applied to a column vector. */
function toMat3(t: JointTransform): Mat3 {
  const c = Math.cos(t.rotation);
  const s = Math.sin(t.rotation);
  const m = new Float32Array(9) as Mat3;
  m[0] = c * t.scaleX;  m[1] = s * t.scaleX;  m[2] = 0;
  m[3] = -s * t.scaleY; m[4] = c * t.scaleY;  m[5] = 0;
  m[6] = t.x;           m[7] = t.y;           m[8] = 1;
  return m;
}

/**
 * Resolve every joint's world transform by walking the skeleton once and
 * composing each joint onto its already-resolved parent.
 *
 * `skeleton.joints` must be in topological order — a joint whose parent has not
 * been resolved yet throws rather than silently resolving against identity,
 * because that failure is otherwise invisible until a limb renders in the wrong
 * place.
 */
export function resolveSkeleton(skeleton: Skeleton, pose: Pose): Map<string, Mat3> {
  const out = new Map<string, Mat3>();
  for (const joint of skeleton.joints) {
    const local = toMat3(compose(joint.bind, pose[joint.name]));
    if (joint.parent == null) {
      out.set(joint.name, local);
      continue;
    }
    const parent = out.get(joint.parent);
    if (!parent) {
      throw new Error(
        `resolveSkeleton: joint "${joint.name}" names parent "${joint.parent}", which has not ` +
        'been resolved. Skeleton.joints must be in topological order.',
      );
    }
    out.set(joint.name, mat3.multiply(parent, local));
  }
  return out;
}
```

- [ ] **Step 4: Confirm `mat3.multiply` exists with that signature**

Run: `grep -n "multiply" packages/core/src/renderer/math/mat3.ts`
Expected: a `multiply(a, b)` returning `Mat3`. If the exported name or argument order differs, adjust the call — the required semantic is "parent then local", i.e. the result applied to a point performs `local` first.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/resolveSkeleton.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/animation/rig/
git commit -m "resolve joint world transforms down a skeleton"
```

---

### Task 12: The pose-track identity

The spec's central claim is that a rig needs no timeline integration because
animating one is a `SampledTrack<Pose>` with `blendPoses` as its interpolator.
That is a claim about behavior, so it gets a test rather than a comment.

**Files:**
- Test: `packages/core/src/animation/rig/poseTrack.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createTimeline, type TimelineRegister } from '../timeline/createTimeline';
import type { SampledTrack } from '../timeline/types';
import { blendPoses } from './blendPoses';
import { resolveSkeleton } from './resolveSkeleton';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './types';

function harness() {
  let tick: ((virtualNow: number) => boolean) | null = null;
  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    return {
      id: seed.id, cancel: () => {}, pause: () => {}, resume: () => {},
      setTimeScale: () => {}, isPaused: () => false,
    };
  };
  return { register, advance: (t: number) => tick!(t) };
}

const skeleton: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};

describe('animating a rig is an ordinary sampled track', () => {
  it('interpolates poses with blendPoses as the track interpolator', () => {
    const h = harness();
    let latest: Pose = {};
    const track: SampledTrack<Pose> = {
      kind: 'sampled',
      label: 'walk',
      keys: [
        { t: 0, value: { hip: { rotation: 0 } } },
        { t: 100, value: { hip: { rotation: 1 } } },
      ],
      interpolate: (a, b, u) => blendPoses([a, b], [1 - u, u]),
      onTick: (p) => { latest = p; },
    };
    createTimeline(h.register, 1, { tracks: [track] });

    h.advance(50);
    expect(latest.hip!.rotation).toBeCloseTo(0.5, 6);
  });

  it('feeds resolveSkeleton to drive joint world transforms over time', () => {
    const h = harness();
    let latest: Pose = {};
    const track: SampledTrack<Pose> = {
      kind: 'sampled',
      keys: [
        { t: 0, value: { hip: { rotation: 0 } } },
        { t: 100, value: { hip: { rotation: Math.PI / 2 } } },
      ],
      interpolate: (a, b, u) => blendPoses([a, b], [1 - u, u]),
      onTick: (p) => { latest = p; },
    };
    createTimeline(h.register, 1, { tracks: [track] });

    h.advance(100);
    const world = resolveSkeleton(skeleton, latest);
    const m = world.get('knee')!;
    expect(m[6]).toBeCloseTo(0, 5);
    expect(m[7]).toBeCloseTo(10, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/poseTrack.test.ts`
Expected: PASS, 2 tests. No implementation needed — that is the point of the task. If it fails, the identity is broken and the failure is the finding.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/animation/rig/poseTrack.test.ts
git commit -m "pin the pose-track identity with a test"
```

---

### Task 13: Rig barrel and public exports

**Files:**
- Create: `packages/core/src/animation/rig/index.ts`
- Modify: `packages/core/src/animation/index.ts`

- [ ] **Step 1: Write the rig barrel**

```ts
// packages/core/src/animation/rig/index.ts
export { blendPoses } from './blendPoses';
export { resolveSkeleton } from './resolveSkeleton';
export { IDENTITY_JOINT } from './types';
export type { Joint, JointTransform, Pose, Skeleton } from './types';
```

- [ ] **Step 2: Re-export from the animation barrel**

Append to `packages/core/src/animation/index.ts`:

```ts
export { blendPoses, resolveSkeleton, IDENTITY_JOINT } from './rig';
export type { Joint, JointTransform, Pose, Skeleton } from './rig';
```

- [ ] **Step 3: Verify the public surface resolves from the package entry**

Create `packages/core/src/animation/rig/exports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as kit from '../../index';

describe('rig public surface', () => {
  it('exports the rig helpers from the package entry', () => {
    expect(typeof kit.blendPoses).toBe('function');
    expect(typeof kit.resolveSkeleton).toBe('function');
    expect(kit.IDENTITY_JOINT).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
  });

  it('exports sampleTrack from the package entry', () => {
    expect(typeof kit.sampleTrack).toBe('function');
  });

  it('does not export createTimeline, which takes an internal seam', () => {
    expect('createTimeline' in kit).toBe(false);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project=kit packages/core/src/animation/rig/exports.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Full gate**

Run: `npx tsc --noEmit && npx vitest run --project=kit && npx eslint packages`
Expected: all three exit 0.

- [ ] **Step 6: Write a changeset**

Create `.changeset/animation-timeline.md`:

```markdown
---
'@weasel-js/core': patch
---

Add a keyframe timeline primitive and a hierarchical rig.

`animator.timeline(opts)` registers like any other animation, so its playhead
responds to `pause`, `setTimeScale` and `cancelKey`. Sampled tracks are a pure
function of the playhead and reuse the tween interpolation contract; event
tracks fire only on forward playback and stay silent under `seek`; timeline
tracks nest.

The rig ships as `blendPoses` and `resolveSkeleton` over a `Skeleton` of joints
with their own TRS. Animating a rig is a `SampledTrack<Pose>` whose
`interpolate` is `blendPoses` — no rig-specific timeline machinery.

This adds API surface. The bump level is deliberate; see CLAUDE.md.
```

- [ ] **Step 7: Verify the bump check passes**

Run: `node scripts/check-changeset-bumps.mjs`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/animation/ .changeset/animation-timeline.md
git commit -m "export the rig surface and add a changeset"
```

---

## Out of scope for this plan

- The `<Timeline>` editor in `@weasel-js/ui` (arc 2 phase 4)
- The `useRig` binding dep, which needs a scene to bind to (arc 2 phase 3 tail)
- The demo (arc 2 phase 5)
- IK, skinning, serializable clips — see the spec's out-of-scope section
