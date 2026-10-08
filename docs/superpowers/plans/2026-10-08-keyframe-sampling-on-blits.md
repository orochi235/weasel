# Keyframe sampling on blits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: not started.** Delete this plan when it merges.

**Goal:** `sampleTrack` computes a keyframe track's value with a blits `keys` patch instead of its own search, easing and lerp, finishing step 3 of the animator-on-blits proposal.

**Architecture:** The timeline keeps its own clock (seek, loops, nesting). Only time-to-value moves: each track's keys are built once into a blits `keys` patch, and `sampleTrack` reads it at the playhead's phase with `patch.at(phase)`. Numeric shapes (number, number array, numeric object) are lerped by blits. A track with `interpolate` or `interpolator` gets its search and easing from blits and makes the value with its own function, the same split the tween codec uses. The built patch is cached on the caller's `segmentCache` map, so the existing rule ("drop the cache when keys change", which `createTimeline.edit` already follows) is the only invalidation.

**Decision taken here, against the proposal's wording:** the proposal says a timeline "cues and seeks voices instead of sampling tracks itself". This plan reads the patch directly and cues no voice. A voice would have to be seeked to the timeline's playhead on every frame, and the codec pulls values *before* the animator ticks, so a voice would read a frame behind on every seek and every loop seam. Nothing would be combined either: a sampled track delivers through `onTick` to the caller, not to a target mix. Voices become worth having in steps 4–5, when targets are mixes. Revisit then.

**Tech Stack:** TypeScript, `@msb235/blits` 0.7.0 (`keys`), vitest.

**Spec:** `docs/proposals/2026-09-30-animator-on-blits.md` (step 3 in "Order"; the "Interpolation, easing, keyframe sampling" row of the proposal's table).

## Global Constraints

- `@msb235/blits` stays pinned exactly at `0.7.0` in `packages/core/package.json`. Do not bump it in this plan.
- blits' types stay out of core's public surface: nothing exported from `@weasel-js/core` may name a blits type.
- `sampleTrack(track, t, segmentCache?)` and the `SampledTrack` / `Keyframe` types keep their signatures. `sampleTrack` is public (`packages/core/src/animation/index.ts`) and is called by `packages/ui/src/components/Timeline/keys.ts` (no cache) and `apps/site/demos/platformer/clips.ts` (one persistent cache per track).
- Core tests run with `npx vitest run --project=core <path>`; run only the files touched while iterating.
- Every changeset is `patch`.
- Benchmarks and the full suite run on the fleet (`onto`), never on this Mac.

## Review Focus

- **Two keys at the same time (a step).** At exactly that time weasel returns the *later* key; blits returns the earlier one (measured: keys 10 and 20 at phase 0.5 read 10). A timeline seeked onto a step must show the after value. Pinned in Task 1.
- **Sampling exactly at an interior key.** blits reaches it as `a + (b - a) * ease(1)`, which is not `b` in floating point (`0.7 + (0.1 - 0.7)` is `0.09999999999999998`), and is not `b` at all for an easing with `ease(1) ≠ 1`. weasel promises the key's exact value. Pinned in Task 1.
- **Every key at one time, or a single key.** The phase span is zero, so phase is undefined. Before that time the first key's value, at or after it the last key's. Pinned in Task 1.
- **A numeric track edited through `timeline.edit`.** Today a numeric track reads its keys live, so an edit took effect even without dropping a cache. After this change the built patch is cached, and only `edit`'s cache drop makes the edit visible. Pinned in Task 2.
- **A caller that replaces `keys` and passes no cache** (the UI's `insertKey`). It must see the new keys on its next call. Pinned in Task 1.

---

## File Structure

- Modify: `packages/core/src/animation/timeline/sampleTrack.ts`. The whole file is rewritten: build a track into a blits patch and read it.
- Modify: `packages/core/src/animation/timeline/types.ts`. Update the `interpolate` doc comment for the new numeric shapes.
- Modify: `packages/core/src/animation/timeline/sampleTrack.test.ts`. Add the edge-case tests.
- Modify: `packages/core/src/animation/timeline/edit.test.ts`. Add the numeric-edit test.
- Create: `tests/perf/bench/timeline-sampling.bench.ts`. Compares today's sampler with the blits one.
- Create: `.changeset/keyframe-sampling-on-blits.md`.
- Modify: `docs/proposals/2026-09-30-animator-on-blits.md`, `docs/TODO.md`. Record step 3 as done.

### Task 1: `sampleTrack` on a blits `keys` patch

**Files:**
- Modify: `packages/core/src/animation/timeline/sampleTrack.ts`
- Modify: `packages/core/src/animation/timeline/types.ts:22-25`
- Test: `packages/core/src/animation/timeline/sampleTrack.test.ts`

**Interfaces:**
- Consumes: `keys` from `@msb235/blits` (`keys(duration, stops, { lerpBy })`, where a stop is `{ at: phase 0..1, delta: { v }, ease? }` and reading is `patch.at(phase, subject, setting).v`); `axesOf` from `../engine/axes`; `resolveEasing` from `@weasel-js/geom`.
- Produces: `sampleTrack<T>(track: SampledTrack<T>, t: number, segmentCache?: Map<number, (u: number) => T>): T | undefined`, unchanged.

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('sampleTrack', …)` block of `sampleTrack.test.ts`:

```ts
  it('takes the later of two keys sharing a time, at exactly that time', () => {
    const t = track([{ t: 0, value: 0 }, { t: 50, value: 10 }, { t: 50, value: 20 }, { t: 100, value: 30 }]);
    expect(sampleTrack(t, 50)).toBe(20);
    expect(sampleTrack(t, 25)).toBe(5);
    expect(sampleTrack(t, 75)).toBe(25);
  });

  it('returns an interior key value exactly, with no float drift', () => {
    // 0.7 + (0.1 - 0.7) * 1 is 0.09999999999999998.
    const t = track([{ t: 0, value: 0.7 }, { t: 100, value: 0.1 }, { t: 200, value: 0.5 }]);
    expect(sampleTrack(t, 100)).toBe(0.1);
  });

  it('returns an interior key value even under an easing that overshoots its end', () => {
    const t = track([{ t: 0, value: 0 }, { t: 100, value: 10, easing: (u) => u * 2 }, { t: 200, value: 0 }]);
    expect(sampleTrack(t, 100)).toBe(10);
  });

  it('holds the first value before, and the last at or after, keys that all share one time', () => {
    const t = track([{ t: 100, value: 1 }, { t: 100, value: 2 }]);
    expect(sampleTrack(t, 50)).toBe(1);
    expect(sampleTrack(t, 100)).toBe(2);
    expect(sampleTrack(t, 150)).toBe(2);
  });

  it('returns a single key value at any time', () => {
    const t = track([{ t: 100, value: 4 }]);
    expect(sampleTrack(t, 0)).toBe(4);
    expect(sampleTrack(t, 500)).toBe(4);
  });

  it('lerps a number array with no interpolate', () => {
    const t: SampledTrack<number[]> = {
      kind: 'sampled', keys: [{ t: 0, value: [0, 0] }, { t: 100, value: [10, 20] }], onTick: () => {},
    };
    expect(sampleTrack(t, 50)).toEqual([5, 10]);
  });

  it('lerps a numeric object with no interpolate', () => {
    const t: SampledTrack<{ x: number; y: number }> = {
      kind: 'sampled', keys: [{ t: 0, value: { x: 0, y: 0 } }, { t: 100, value: { x: 10, y: 20 } }], onTick: () => {},
    };
    expect(sampleTrack(t, 50)).toEqual({ x: 5, y: 10 });
  });

  it('throws for keys whose numeric shapes differ', () => {
    const t = {
      kind: 'sampled', keys: [{ t: 0, value: [0, 0] }, { t: 100, value: [1, 2, 3] }], onTick: () => {},
    } as SampledTrack<number[]>;
    expect(() => sampleTrack(t, 50)).toThrow(/shape/);
  });

  it('sees replaced keys on the next call when no cache is passed', () => {
    const t = track([{ t: 0, value: 0 }, { t: 100, value: 10 }]);
    expect(sampleTrack(t, 50)).toBe(5);
    t.keys = [{ t: 0, value: 0 }, { t: 100, value: 100 }];
    expect(sampleTrack(t, 50)).toBe(50);
  });

  it('rebuilds once a dropped cache is replaced by a fresh one', () => {
    const build = vi.fn((a: number, b: number) => (u: number) => a + (b - a) * u);
    const t: SampledTrack<number> = {
      kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 10 }], interpolator: build, onTick: () => {},
    };
    sampleTrack(t, 10, new Map());
    t.keys[1].value = 1000;
    expect(sampleTrack(t, 50, new Map())).toBe(500);
    expect(build).toHaveBeenCalledTimes(2);
  });
```

Leave the existing `'throws for non-numeric values with no interpolate'` test as it is. Strings stay unsupported, and it must still pass.

- [ ] **Step 2: Run the tests to verify which ones fail**

Run: `npx vitest run --project=core packages/core/src/animation/timeline/sampleTrack.test.ts`
Expected: FAIL in "lerps a number array", "lerps a numeric object" and "throws for keys whose numeric shapes differ" (the old sampler throws `interpolate or interpolator is required`). The step, float-drift, overshoot, one-time and replaced-keys tests already pass on today's sampler. They are guards against the port.

- [ ] **Step 3: Rewrite `sampleTrack.ts`**

Replace the whole file with:

```ts
import { keys as keysPatch, type Patch, type Setting } from '@msb235/blits';
import { resolveEasing } from '@weasel-js/geom';
import { axesOf } from '../engine/axes';
import type { SampledTrack } from './types';

type Out = { v: unknown };
/** What an interpolated track's stops carry: blits finds the segment and eases it, and the
 *  track's own function makes the value. */
interface Box { i: number; value: unknown }

interface Built {
  patch: Patch<number, Out, void> | null;
  t0: number;
  span: number;
  /** Every key's time to the value sampling exactly there returns: the later of keys sharing a
   *  time, and the key's own value where blits would reach it as `a + (b - a) * ease(1)`. */
  exact: Map<number, unknown>;
  first: unknown;
  last: unknown;
  read: (v: unknown) => unknown;
}

const NO_SETTING = {} as Setting<void>;
const built = new WeakMap<object, Built>();

function build<T>(track: SampledTrack<T>, cache: Map<number, (u: number) => T> | undefined): Built {
  const { keys } = track;
  let t0 = Infinity;
  let t1 = -Infinity;
  const exact = new Map<number, unknown>();
  for (const k of keys) {
    t0 = Math.min(t0, k.t);
    t1 = Math.max(t1, k.t);
    exact.set(k.t, k.value);
  }
  const span = t1 - t0;
  const out: Built = { patch: null, t0, span, exact, first: keys[0].value, last: keys[keys.length - 1].value, read: (v) => v };
  if (span <= 0) return out;

  const ease = (k: (typeof keys)[number]) => (k.easing ? resolveEasing(k.easing) : undefined);
  const { interpolator, interpolate } = track;
  if (interpolator || interpolate) {
    const boxes: Box[] = keys.map((k, i) => ({ i, value: k.value }));
    const lerp = (a: Box, b: Box, u: number): Box => {
      if (interpolator) {
        let fn = cache?.get(b.i);
        if (!fn) {
          fn = interpolator(a.value as T, b.value as T);
          cache?.set(b.i, fn);
        }
        return { i: -1, value: fn(u) };
      }
      return { i: -1, value: interpolate!(a.value as T, b.value as T, u) };
    };
    out.patch = keysPatch<number, Out>(
      1,
      keys.map((k, i) => ({ at: (k.t - t0) / span, delta: { v: boxes[i] }, ease: ease(k) })),
      { lerpBy: () => lerp as (a: never, b: never, u: number) => unknown },
    );
    out.read = (v) => (v as Box).value;
    return out;
  }

  const axes = axesOf(keys[0].value);
  if (!axes) throw new Error('sampleTrack: interpolate or interpolator is required for non-numeric keyframe values');
  for (const k of keys) {
    if (axesOf(k.value)?.shape !== axes.shape) {
      throw new Error(`sampleTrack: every key needs the shape of the first (${axes.shape})`);
    }
  }
  const scalar = axes.shape === 'number';
  out.patch = keysPatch<number, Out>(
    1,
    keys.map((k) => ({ at: (k.t - t0) / span, delta: { v: scalar ? k.value : axes.to(k.value) }, ease: ease(k) })),
  );
  if (!scalar) out.read = (v) => axes.from(v as number[]);
  return out;
}

/**
 * Sample a track at `t`. Pure: no state, no side effects, safe to call for any
 * `t` in any order — which is what makes scrubbing free.
 *
 * `segmentCache` holds what sampling builds from the keys: the track's blits
 * patch and its `interpolator` factories. A cache belongs to one track, and
 * callers that mutate keys must drop it; `createTimeline` drops it wholesale on
 * `edit`. With no cache, every call builds afresh.
 */
export function sampleTrack<T>(
  track: SampledTrack<T>,
  t: number,
  segmentCache?: Map<number, (u: number) => T>,
): T | undefined {
  if (track.keys.length === 0) return undefined;
  let b = segmentCache && built.get(segmentCache);
  if (!b) {
    b = build(track, segmentCache);
    if (segmentCache) built.set(segmentCache, b);
  }
  const hit = b.exact.get(t);
  if (hit !== undefined || b.exact.has(t)) return hit as T;
  if (!b.patch) return (t < b.t0 ? b.first : b.last) as T;
  return b.read(b.patch.at((t - b.t0) / b.span, 0, NO_SETTING).v) as T;
}
```

In `types.ts`, change the `interpolate` comment on `SampledTrack` to:

```ts
  /** Required unless every key's value is a number, a number array or a plain
   *  object of numbers, all of one shape; those are lerped field by field. */
```

- [ ] **Step 4: Run the timeline tests**

Run: `npx vitest run --project=core packages/core/src/animation/timeline packages/core/src/animation/rig`
Expected: PASS, every file. `rig/poseTrack.test.ts` drives `SampledTrack<Pose>` through `interpolate` and covers the boxed path.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/animation/timeline/sampleTrack.ts packages/core/src/animation/timeline/sampleTrack.test.ts packages/core/src/animation/timeline/types.ts
git commit -m "sample keyframe tracks with a blits keys patch"
```

### Task 2: An edited numeric track through `timeline.edit`

**Files:**
- Test: `packages/core/src/animation/timeline/edit.test.ts`

**Interfaces:**
- Consumes: `sampleTrack` from Task 1, unchanged signature; the harness already imported at the top of `edit.test.ts`.
- Produces: nothing new.

- [ ] **Step 1: Write the test**

Add to the `describe('timeline editing', …)` block of `edit.test.ts`, beside the interpolator version of the same test:

```ts
  it('an edited key of a plain numeric track takes effect', () => {
    const h = harness();
    const seen: number[] = [];
    const track: SampledTrack<number> = {
      kind: 'sampled',
      keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
      onTick: (v) => seen.push(v),
    };
    const tl = createTimeline(h.register, 1, { tracks: [track] });
    h.advance(50);
    expect(seen.at(-1)).toBe(50);

    tl.edit(() => { track.keys[1].value = 1000; });
    h.advance(50);
    expect(seen.at(-1)).toBe(500);
  });
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project=core packages/core/src/animation/timeline/edit.test.ts`
Expected: PASS. Then make it fail on purpose: in `createTimeline.ts`'s `edit`, comment out `caches = new WeakMap();` and run again. Expected: FAIL. This proves the test sees a stale build. Restore the line.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/animation/timeline/edit.test.ts
git commit -m "pin that an edit reaches a numeric keyframe track"
```

### Task 3: Measure, record, and close step 3

**Files:**
- Create: `tests/perf/bench/timeline-sampling.bench.ts`
- Create: `.changeset/keyframe-sampling-on-blits.md`
- Modify: `docs/proposals/2026-09-30-animator-on-blits.md`
- Modify: `docs/TODO.md` (the "Combining animations" entry)

**Interfaces:**
- Consumes: `sampleTrack` from `@weasel-js/core`; `group` from `./group`.

- [ ] **Step 1: Write the bench**

```ts
/**
 * Keyframe sampling before and after it moved onto a blits `keys` patch
 * (step 3 of `docs/proposals/2026-09-30-animator-on-blits.md`). One iteration
 * samples N four-key tracks once each at an advancing playhead, the way a
 * timeline's frame does.
 */
import { resolveEasing } from '@weasel-js/geom';
import { sampleTrack, type SampledTrack } from '@weasel-js/core';
import { group } from './group';

/** The sampler as it was before the port, kept here as the baseline. */
function today(track: SampledTrack<number>, t: number): number | undefined {
  const { keys } = track;
  if (keys.length === 0) return undefined;
  let lo = 0, hi = keys.length - 1, i = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (keys[mid].t <= t) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  if (i < 0) return keys[0].value;
  if (i >= keys.length - 1) return keys[keys.length - 1].value;
  const a = keys[i], b = keys[i + 1];
  const raw = (t - a.t) / (b.t - a.t);
  const u = b.easing ? resolveEasing(b.easing)(raw) : raw;
  return a.value + (b.value - a.value) * u;
}

const tracks = (n: number): SampledTrack<number>[] =>
  Array.from({ length: n }, (_, k) => ({
    kind: 'sampled',
    keys: [{ t: 0, value: k }, { t: 300, value: k + 10, easing: 'easeInOutQuad' }, { t: 700, value: k - 5 }, { t: 1000, value: k }],
    onTick: () => {},
  }));

for (const n of [100, 1000, 10000]) {
  const ts = tracks(n);
  const caches = ts.map(() => new Map<number, (u: number) => number>());
  let sink = 0;
  let clock = 0;
  group(`${n} tracks, one frame`, (bench) => {
    bench('today', () => { clock = (clock + 16) % 1000; for (let k = 0; k < n; k++) sink += today(ts[k], clock)!; });
    bench('blits keys', () => { clock = (clock + 16) % 1000; for (let k = 0; k < n; k++) sink += sampleTrack(ts[k], clock, caches[k])!; });
  });
  if (sink === Infinity) console.log(sink);
}
```

- [ ] **Step 2: Run it on the fleet**

Run the bench with the `onto-job` skill. Don't run it on this Mac. The command is `npx vitest bench --run --config tests/perf/vitest.bench.config.ts tests/perf/bench/timeline-sampling.bench.ts`, at least two passes alternated. Expected: both rows finish, and you have ms per frame for each N.

- [ ] **Step 3: Record step 3 as done in the proposal**

In `docs/proposals/2026-09-30-animator-on-blits.md`:
- Change the status paragraph to say steps 1–3 are built, that sampling is on `@msb235/blits` 0.7.0, and that steps 4–6 are not built.
- In "Order", item 3: replace "Keyframe sampling not started." with "Keyframe sampling done 2026-10-08; see "What step 3 built"."
- Under "What step 3 built", add a **Keyframe sampling.** bullet. Say that `sampleTrack` reads a blits `keys` patch built once per cache, and that numeric shapes now lerp without `interpolate`. Give the measured table from Step 2 with the machine, Node version and number of passes, in the same form as the other tables. Then add one paragraph on why it cues no voice (copy the reasoning from this plan's "Decision taken here").

- [ ] **Step 4: Update `docs/TODO.md`**

In the "Combining animations" entry, delete the bullet "Keyframe sampling (`timeline/sampleTrack.ts`) on blits, the rest of step 3. Needs a plan." and change "Built: … (most of step 3)" to say step 3 is built.

- [ ] **Step 5: Write the changeset**

`.changeset/keyframe-sampling-on-blits.md`:

```md
---
'@weasel-js/core': patch
---

`sampleTrack` and timeline keyframe tracks compute their values with blits, the same engine tweens and springs run on. A track of number arrays or numeric objects no longer needs an `interpolate`, and keys whose shapes differ throw. Edits to keys must go through `timeline.edit` (or a dropped `segmentCache`) to take effect, which numeric tracks used to get away without.
```

- [ ] **Step 6: Commit and delete this plan**

```bash
git rm docs/superpowers/plans/2026-10-08-keyframe-sampling-on-blits.md
git add tests/perf/bench/timeline-sampling.bench.ts .changeset/keyframe-sampling-on-blits.md docs/proposals/2026-09-30-animator-on-blits.md docs/TODO.md
git commit -m "record keyframe sampling on blits, finishing step 3"
```
