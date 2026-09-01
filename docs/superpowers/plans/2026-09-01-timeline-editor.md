# Timeline Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `<Timeline>`, a keyframe editor for weasel's timeline primitive, plus the two `@weasel-js/core` changes it depends on.

**Architecture:** Two arcs. Arc A widens `easing` from a bare function to a describable `EasingSpec` (function, name, or cubic-bezier control points) resolved at the four sites easing is invoked, and adds `TimelineHandle.setLoop`. Arc B builds a pure controlled `<Timeline>` plus an `<AnimatedTimeline>` wrapper bound to a live handle, with the geometry and edit algebra in four separately-tested `.ts` modules underneath.

**Tech Stack:** TypeScript, React 18+, vitest (`kit` project for core, `weasel-ui` for ui), CSS modules, Storybook.

**Spec:** `docs/superpowers/specs/2026-09-01-timeline-editor-design.md`

**Branch:** `ui/timeline-editor`

---

# Arc A — core

## Task 1: `EasingSpec` and `resolveEasing`

**Files:**
- Create: `packages/core/src/animation/easingSpec.ts`
- Create: `packages/core/src/animation/easingSpec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/animation/easingSpec.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveEasing, cubicBezierEasing } from './easingSpec';
import { easeOutBack, linear } from './easings';

describe('resolveEasing', () => {
  it('resolves undefined to linear', () => {
    const fn = resolveEasing(undefined);
    expect(fn(0)).toBe(0);
    expect(fn(0.5)).toBe(0.5);
    expect(fn(1)).toBe(1);
  });

  it('passes a function through unchanged', () => {
    expect(resolveEasing(easeOutBack)).toBe(easeOutBack);
    expect(resolveEasing(linear)).toBe(linear);
  });

  it('resolves a name to its built-in curve', () => {
    expect(resolveEasing('easeOutBack')).toBe(easeOutBack);
  });

  it('throws on a name that is not a built-in', () => {
    // @ts-expect-error deliberately outside EasingName
    expect(() => resolveEasing('easeOutNonsense')).toThrow(/unknown easing/i);
  });

  it('resolves a bezier spec to a curve pinned at both ends', () => {
    const fn = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    expect(fn(0)).toBeCloseTo(0, 6);
    expect(fn(1)).toBeCloseTo(1, 6);
  });

  it('returns the same function for two equal bezier specs', () => {
    const a = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    const b = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    expect(a).toBe(b);
  });

  it('returns different functions for different bezier specs', () => {
    const a = resolveEasing({ bezier: [0.4, 0, 0.2, 1] });
    const b = resolveEasing({ bezier: [0.25, 0.1, 0.25, 1] });
    expect(a).not.toBe(b);
  });
});

describe('cubicBezierEasing', () => {
  it('reproduces linear for the identity control points', () => {
    const fn = cubicBezierEasing(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      expect(fn(t)).toBeCloseTo(t, 4);
    }
  });

  it('is monotone non-decreasing for a monotone curve', () => {
    const fn = cubicBezierEasing(0.4, 0, 0.2, 1);
    let prev = -Infinity;
    for (let i = 0; i <= 100; i++) {
      const v = fn(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it('eases out: ahead of linear through the first half', () => {
    const fn = cubicBezierEasing(0, 0, 0.2, 1);
    expect(fn(0.25)).toBeGreaterThan(0.25);
  });

  it('clamps input outside 0..1', () => {
    const fn = cubicBezierEasing(0.4, 0, 0.2, 1);
    expect(fn(-1)).toBeCloseTo(0, 6);
    expect(fn(2)).toBeCloseTo(1, 6);
  });

  it('leaves the unit range for an overshooting curve', () => {
    const fn = cubicBezierEasing(0.34, 1.56, 0.64, 1);
    let max = 0;
    for (let i = 0; i <= 100; i++) max = Math.max(max, fn(i / 100));
    expect(max).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/easingSpec.test.ts`

Expected: FAIL — `Failed to resolve import "./easingSpec"`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/core/src/animation/easingSpec.ts`:

```ts
import { EASINGS, type EasingName } from './easings';
import type { EasingFn } from './types';

/** Cubic-bezier control points, CSS `cubic-bezier()` order. The curve's two
 *  endpoints are implicit at (0,0) and (1,1). */
export interface BezierEasing {
  bezier: [number, number, number, number];
}

/** An easing curve as a value: a function, the name of a built-in, or control
 *  points. Anything an editor has to name, show or serialize must not be a bare
 *  function, which is why the union exists. */
export type EasingSpec = EasingFn | EasingName | BezierEasing;

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 1e-3;
const SUBDIVISION_EPSILON = 1e-7;
const SUBDIVISION_MAX = 12;

function bezierAt(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function bezierSlope(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}

/** Solve for the bezier parameter that puts the curve at `x`. Newton-Raphson
 *  where the slope allows it, bisection where it does not — the standard
 *  approach, and the one browsers use for `cubic-bezier()`. */
function solveForX(x: number, x1: number, x2: number): number {
  let t = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const slope = bezierSlope(t, x1, x2);
    if (slope < NEWTON_MIN_SLOPE) break;
    t -= (bezierAt(t, x1, x2) - x) / slope;
  }
  let lo = 0;
  let hi = 1;
  t = Math.min(1, Math.max(0, t));
  for (let i = 0; i < SUBDIVISION_MAX; i++) {
    const err = bezierAt(t, x1, x2) - x;
    if (Math.abs(err) < SUBDIVISION_EPSILON) return t;
    if (err > 0) hi = t; else lo = t;
    t = (lo + hi) / 2;
  }
  return t;
}

/** Build the easing curve for four cubic-bezier control points. */
export function cubicBezierEasing(
  x1: number, y1: number, x2: number, y2: number,
): EasingFn {
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return bezierAt(solveForX(t, x1, x2), y1, y2);
  };
}

/** Memoized so two equal specs resolve to one function — `sampleTrack` is on a
 *  per-frame path and must not build a solver per call. */
const bezierCache = new Map<string, EasingFn>();

function isBezier(spec: EasingSpec): spec is BezierEasing {
  return typeof spec === 'object' && spec !== null && 'bezier' in spec;
}

/** Resolve a spec to the function that shapes progress. `undefined` is linear. */
export function resolveEasing(spec?: EasingSpec): EasingFn {
  if (spec === undefined) return EASINGS.linear;
  if (typeof spec === 'function') return spec;
  if (typeof spec === 'string') {
    const fn = EASINGS[spec];
    if (!fn) throw new Error(`resolveEasing: unknown easing name "${spec}"`);
    return fn;
  }
  if (isBezier(spec)) {
    const [x1, y1, x2, y2] = spec.bezier;
    const key = `${x1},${y1},${x2},${y2}`;
    let fn = bezierCache.get(key);
    if (!fn) {
      fn = cubicBezierEasing(x1, y1, x2, y2);
      bezierCache.set(key, fn);
    }
    return fn;
  }
  throw new Error('resolveEasing: unrecognized easing spec');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/easingSpec.test.ts`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/easingSpec.ts packages/core/src/animation/easingSpec.test.ts
git commit -m "add EasingSpec and resolveEasing"
```

---

## Task 2: Route the four easing invocation sites through `resolveEasing`

**Files:**
- Modify: `packages/core/src/animation/types.ts` (the `easing?:` fields)
- Modify: `packages/core/src/animation/timeline/types.ts:56` (`Keyframe.easing`)
- Modify: `packages/core/src/animation/timeline/sampleTrack.ts:46`
- Modify: `packages/core/src/animation/useAnimator.ts:301`
- Modify: `packages/core/src/animation/colorHelpers.ts:183` and `:259`
- Modify: `packages/core/src/core/viewport/useViewAnimation.ts:92`
- Create: `packages/core/src/animation/timeline/easingSpec.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/animation/timeline/easingSpec.integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack } from './types';

function track(easing: SampledTrack<number>['keys'][number]['easing']): SampledTrack<number> {
  return {
    kind: 'sampled',
    keys: [
      { t: 0, value: 0 },
      { t: 100, value: 100, easing },
    ],
    onTick: () => {},
  };
}

describe('sampleTrack easing specs', () => {
  it('samples with no easing as linear', () => {
    expect(sampleTrack(track(undefined), 50)).toBeCloseTo(50, 6);
  });

  it('accepts a named easing', () => {
    // easeInQuad at u=0.5 is 0.25.
    expect(sampleTrack(track('easeInQuad'), 50)).toBeCloseTo(25, 6);
  });

  it('accepts a bezier easing', () => {
    // Identity control points reproduce linear.
    const v = sampleTrack(track({ bezier: [1 / 3, 1 / 3, 2 / 3, 2 / 3] }), 50);
    expect(v).toBeCloseTo(50, 3);
  });

  it('still accepts a bare function', () => {
    expect(sampleTrack(track((t) => t * t), 50)).toBeCloseTo(25, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/easingSpec.integration.test.ts`

Expected: FAIL — the named and bezier cases throw `b.easing is not a function`. The `undefined` and bare-function cases already pass; that is correct, they are the regression guard.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/animation/types.ts`, add the re-export near the top (after the `EasingFn` declaration) so every options interface can reach it:

```ts
export type { BezierEasing, EasingSpec } from './easingSpec';
export { cubicBezierEasing, resolveEasing } from './easingSpec';
```

Then change each `easing?: EasingFn;` to `easing?: EasingSpec;` in `TweenOptions`, `StaggerTweenOptions` and `TweenLoopOptions`, adding the import:

```ts
import type { EasingSpec } from './easingSpec';
```

In `packages/core/src/animation/timeline/types.ts`, change `Keyframe`:

```ts
import type { EasingFn, EasingSpec, Interpolate, InterpolatorFactory } from '../types';

export interface Keyframe<T> {
  /** Time within the track's timeline, in ms. */
  t: number;
  value: T;
  /** A function, the name of a built-in, or cubic-bezier control points. */
  easing?: EasingSpec;
}
```

`EasingFn` stays imported — `AnimationHandle` and the rest of the file still reference it.

In `packages/core/src/animation/timeline/sampleTrack.ts`, add the import and replace line 46:

```ts
import { resolveEasing } from '../easingSpec';
```

```ts
  // `easing` belongs to the key being approached, so `b` supplies it.
  const u = b.easing ? resolveEasing(b.easing)(raw) : raw;
```

In `packages/core/src/animation/useAnimator.ts:301`:

```ts
      const easing = resolveEasing(o.easing ?? easeOut);
```

with `resolveEasing` added to its existing import from `./easingSpec`.

In `packages/core/src/animation/colorHelpers.ts`, both sites collapse — `resolveEasing(undefined)` is already linear:

```ts
  const easing = resolveEasing(opts.easing);
```

In `packages/core/src/core/viewport/useViewAnimation.ts:92` the value is only forwarded to `tween`, so it needs no resolution — only its declared type widens. Change the `easing?: EasingFn` field on `ViewAnimationOptions` to `easing?: EasingSpec` and update the import.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/easingSpec.integration.test.ts`

Expected: PASS — 4 tests.

Then the full core suite, which must show no regressions:

Run: `npx vitest run --project=kit`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0. (Run from the repo root — `tsc -p packages/core/tsconfig.json` exits 1 with 31 pre-existing `TS6059` errors that are not yours.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation packages/core/src/core/viewport/useViewAnimation.ts
git commit -m "accept a named or bezier easing wherever a curve is taken"
```

---

## Task 3: Export the easing spec surface

**Files:**
- Modify: `packages/core/src/animation/index.ts`
- Modify: `packages/core/src/index.ts:1096` region

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/animation/easingSpec.exports.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import * as core from '../index';

describe('easing spec exports', () => {
  it('exports resolveEasing and cubicBezierEasing from the core barrel', () => {
    expect(typeof core.resolveEasing).toBe('function');
    expect(typeof core.cubicBezierEasing).toBe('function');
  });

  it('resolves a name through the barrel export', () => {
    expect(core.resolveEasing('easeOutBack')).toBe(core.easeOutBack);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/easingSpec.exports.test.ts`

Expected: FAIL — `core.resolveEasing is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/animation/index.ts`, add after the `./easings` export block:

```ts
export {
  cubicBezierEasing,
  resolveEasing,
} from './easingSpec';
export type { BezierEasing, EasingSpec } from './easingSpec';
```

`packages/core/src/index.ts` re-exports `./animation` wholesale in the block at line 1096; confirm with `grep -n "from './animation'" packages/core/src/index.ts` and add the two names to the explicit list if that block enumerates rather than stars.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/easingSpec.exports.test.ts`

Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/index.ts packages/core/src/index.ts packages/core/src/animation/easingSpec.exports.test.ts
git commit -m "export resolveEasing and the spec types from core"
```

---

## Task 4: `TimelineHandle.setLoop`

**Files:**
- Modify: `packages/core/src/animation/timeline/types.ts` (`TimelineHandle`)
- Modify: `packages/core/src/animation/timeline/createTimeline.ts:74` and the returned handle
- Create: `packages/core/src/animation/timeline/setLoop.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/animation/timeline/setLoop.test.ts`. Model it on the existing harness in `createTimeline.test.ts` — read that file first and reuse its `register` stub and clock driver rather than inventing a second one.

```ts
import { describe, expect, it } from 'vitest';
import { makeTimeline } from './createTimeline.test-harness';

describe('setLoop', () => {
  it('turns an endless loop on for a timeline that was not looping', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    handle.setLoop(true);
    advance(250);
    expect(handle.time()).toBeCloseTo(50, 6);
  });

  it('turns an endless loop off, letting the timeline finish', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: true });
    advance(50);
    handle.setLoop(false);
    advance(200);
    expect(handle.time()).toBe(100);
  });

  it('sets a finite lap count', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    handle.setLoop(2);
    advance(350);
    expect(handle.time()).toBe(100);
  });

  it('does not move a timeline parked at duration', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    advance(150);
    expect(handle.time()).toBe(100);
    handle.setLoop(true);
    expect(handle.time()).toBe(100);
    advance(50);
    expect(handle.time()).toBe(100);
  });

  it('loops once a parked timeline is rewound and resumed', () => {
    const { handle, advance } = makeTimeline({ duration: 100, loop: false });
    advance(150);
    handle.setLoop(true);
    handle.seek(0);
    handle.resume();
    advance(250);
    expect(handle.time()).toBeCloseTo(50, 6);
  });
});
```

Extract the harness from `createTimeline.test.ts` into `packages/core/src/animation/timeline/createTimeline.test-harness.ts` and have both files import it, so there is one clock driver rather than two that can drift.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/setLoop.test.ts`

Expected: FAIL — `handle.setLoop is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `packages/core/src/animation/timeline/types.ts`, add to `TimelineHandle`:

```ts
  /** Change the loop policy. `true` loops forever, `n` allows n more laps,
   *  `false` stops at `duration`. Sets policy only — a timeline already parked
   *  at `duration` does not restart, because `rearm` declines to revive one.
   *  Rewind it with `seek(0)` and `resume()` to play it again. */
  setLoop(loop: boolean | number): void;
```

In `packages/core/src/animation/timeline/createTimeline.ts`, `loopsLeft` at line 74 is already a `let`. Add to the returned handle, beside `seek`:

```ts
    setLoop(loop) {
      loopsLeft = loop === true ? Infinity : loop === false ? 0 : loop;
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit packages/core/src/animation/timeline/setLoop.test.ts`

Expected: PASS — 5 tests.

Run: `npx vitest run --project=kit`

Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/animation/timeline
git commit -m "let a timeline's loop policy change after it is created"
```

---

## Task 5: Arc A changeset and TODO

**Files:**
- Create: `.changeset/timeline-easing-spec-and-setloop.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/timeline-easing-spec-and-setloop.md`. **`patch`, always** — every changeset in this repo is `patch` regardless of what it contains; `minor`/`major` are Mike's explicit call and `npm run check:bumps` enforces it.

```markdown
---
'@weasel-js/core': patch
---

Accept a named or cubic-bezier easing wherever a curve is taken, and let a
timeline's loop policy change after it is created.

`easing` was a bare function everywhere, which is fine to call and impossible to
name back, show in a picker, or serialize. It now also accepts the name of a
built-in (`'easeOutBack'`) or control points (`{ bezier: [0.4, 0, 0.2, 1] }`),
resolved by `resolveEasing` at the four places a curve is actually invoked. The
union is additive, so every existing function value stays assignable.

`TimelineHandle.setLoop(loop)` sets policy and nothing else. A timeline already
parked at its duration does not restart — `rearm` declines to revive one — so
play it again by seeking to 0 and resuming. Restoring saved transport state
therefore cannot start playback as a side effect.
```

- [ ] **Step 2: Retire the TODO entry**

In `docs/TODO.md`, delete the `(P2) loop cannot be changed after a timeline is created` entry under **Animation → Timelines and rigging** in full — its blocker was the semantic decision, which is now made and shipped. Remove its line from the **High-priority index** as well; the index is a hand-maintained copy, so both must move together.

In the side-scroller list under the same heading, the sentence naming `TimelineHandle` has no `setLoop` as a second site wanting it must go too. Leave the tiled-content half of that sentence intact.

- [ ] **Step 3: Verify the bump check passes**

Run: `npm run check:bumps`

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add .changeset/timeline-easing-spec-and-setloop.md docs/TODO.md
git commit -m "record the easing-spec and setLoop changes"
```

---

# Arc B — `@weasel-js/ui`

## File structure

Everything lives in `packages/ui/src/components/Timeline/`. The four `.ts` modules hold all the
geometry and the edit algebra and are tested on their own; the `.tsx` files render and route
gestures and hold no arithmetic worth testing in isolation. This follows `CurveEditor`, the closest
complexity peer in the package.

| File | Responsibility |
|---|---|
| `timeScale.ts` | ms ↔ px across a zoom/pan window; ruler tick selection |
| `lanes.ts` | `Track[]` → flat lane rows, nested timelines flattened with their offsets |
| `keys.ts` | move / insert / delete / re-ease / re-value, always returning sorted tracks |
| `easingSpec.ts` | an `EasingSpec` → a picker label, control points, or a sampled polyline |
| `Ruler.tsx` | ticks, playhead, scrub gesture, zoom/pan gesture |
| `Lane.tsx` | one row, dope and graph rendering |
| `Transport.tsx` | play / pause / loop / rate / time readout |
| `Timeline.tsx` | the pure controlled component; owns selection and window state |
| `AnimatedTimeline.tsx` | binds the above to a live `TimelineHandle` |

All tests run under `npx vitest run --project=weasel-ui`.

---

## Task 6: `timeScale.ts`

**Files:**
- Create: `packages/ui/src/components/Timeline/timeScale.ts`
- Create: `packages/ui/src/components/Timeline/timeScale.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createTimeScale, panWindow, tickTimes, zoomWindow } from './timeScale';

describe('createTimeScale', () => {
  it('maps the window ends to the track ends', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 500);
    expect(s.toPx(0)).toBe(0);
    expect(s.toPx(1000)).toBe(500);
    expect(s.toPx(500)).toBe(250);
  });

  it('maps px back to ms', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 500);
    expect(s.toMs(250)).toBe(500);
    expect(s.toMs(0)).toBe(0);
  });

  it('round-trips through a panned window', () => {
    const s = createTimeScale({ from: 400, to: 900 }, 250);
    expect(s.toMs(s.toPx(650))).toBeCloseTo(650, 9);
  });

  it('survives a zero-width track without dividing by zero', () => {
    const s = createTimeScale({ from: 0, to: 1000 }, 0);
    expect(Number.isFinite(s.toMs(0))).toBe(true);
  });

  it('survives a zero-length window', () => {
    const s = createTimeScale({ from: 500, to: 500 }, 200);
    expect(Number.isFinite(s.toPx(500))).toBe(true);
  });
});

describe('zoomWindow', () => {
  it('holds the anchor time still', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 250, 0.5, { from: 0, to: 1000 });
    const before = (250 - 0) / 1000;
    const after = (250 - w.from) / (w.to - w.from);
    expect(after).toBeCloseTo(before, 9);
  });

  it('narrows on a factor below 1', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 500, 0.5, { from: 0, to: 1000 });
    expect(w.to - w.from).toBeCloseTo(500, 9);
  });

  it('never widens past the bounds', () => {
    const w = zoomWindow({ from: 0, to: 1000 }, 500, 4, { from: 0, to: 1000 });
    expect(w.from).toBe(0);
    expect(w.to).toBe(1000);
  });

  it('refuses to collapse below the minimum span', () => {
    let w = { from: 0, to: 1000 };
    for (let i = 0; i < 50; i++) w = zoomWindow(w, 500, 0.5, { from: 0, to: 1000 });
    expect(w.to - w.from).toBeGreaterThan(0);
  });
});

describe('panWindow', () => {
  it('shifts both ends together', () => {
    const w = panWindow({ from: 100, to: 600 }, 50, { from: 0, to: 1000 });
    expect(w).toEqual({ from: 150, to: 650 });
  });

  it('clamps at the bounds without changing the span', () => {
    const w = panWindow({ from: 100, to: 600 }, -400, { from: 0, to: 1000 });
    expect(w.from).toBe(0);
    expect(w.to - w.from).toBe(500);
  });
});

describe('tickTimes', () => {
  it('returns ticks inside the window, ascending', () => {
    const ticks = tickTimes({ from: 0, to: 1000 }, 500, 50);
    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[0]).toBeGreaterThanOrEqual(0);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(1000);
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });

  it('honours the minimum pixel spacing', () => {
    const w = { from: 0, to: 1000 };
    const ticks = tickTimes(w, 200, 50);
    const s = createTimeScale(w, 200);
    for (let i = 1; i < ticks.length; i++) {
      expect(s.toPx(ticks[i]) - s.toPx(ticks[i - 1])).toBeGreaterThanOrEqual(50 - 1e-9);
    }
  });

  it('uses round numbers, not arbitrary divisions', () => {
    const ticks = tickTimes({ from: 0, to: 1000 }, 500, 90);
    for (const t of ticks) expect(t % 100).toBeCloseTo(0, 9);
  });

  it('returns no ticks for a zero-width track', () => {
    expect(tickTimes({ from: 0, to: 1000 }, 0, 50)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/timeScale.test.ts`

Expected: FAIL — `Failed to resolve import "./timeScale"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/** A visible span of timeline time, in ms. */
export interface TimeWindow {
  from: number;
  to: number;
}

export interface TimeScale {
  window: TimeWindow;
  widthPx: number;
  toPx(ms: number): number;
  toMs(px: number): number;
}

/** Narrowest window the user can zoom to, in ms. Below this the playhead and
 *  the keys it sits between stop being separable at any sane track width. */
const MIN_SPAN_MS = 1;

export function createTimeScale(window: TimeWindow, widthPx: number): TimeScale {
  const span = window.to - window.from;
  const perMs = span === 0 ? 0 : widthPx / span;
  const perPx = widthPx === 0 ? 0 : span / widthPx;
  return {
    window,
    widthPx,
    toPx: (ms) => (ms - window.from) * perMs,
    toMs: (px) => window.from + px * perPx,
  };
}

function clampWindow(w: TimeWindow, bounds: TimeWindow): TimeWindow {
  const span = Math.min(w.to - w.from, bounds.to - bounds.from);
  let from = w.from;
  if (from < bounds.from) from = bounds.from;
  if (from + span > bounds.to) from = bounds.to - span;
  return { from, to: from + span };
}

/** Scale the window by `factor` about `atMs`, which stays at the same fraction
 *  of the track. `factor < 1` zooms in. */
export function zoomWindow(
  w: TimeWindow, atMs: number, factor: number, bounds: TimeWindow,
): TimeWindow {
  const span = w.to - w.from;
  const maxSpan = bounds.to - bounds.from;
  const nextSpan = Math.min(maxSpan, Math.max(MIN_SPAN_MS, span * factor));
  const frac = span === 0 ? 0.5 : (atMs - w.from) / span;
  return clampWindow({ from: atMs - frac * nextSpan, to: atMs + (1 - frac) * nextSpan }, bounds);
}

/** Shift the window by `byMs`, preserving its span. */
export function panWindow(w: TimeWindow, byMs: number, bounds: TimeWindow): TimeWindow {
  return clampWindow({ from: w.from + byMs, to: w.to + byMs }, bounds);
}

/** 1, 2, 5, 10, 20, 50, … — the tick steps that read as round numbers. */
function niceStep(roughMs: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(roughMs)));
  const norm = roughMs / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** Ruler tick times inside `w`, spaced at least `minSpacingPx` apart. */
export function tickTimes(w: TimeWindow, widthPx: number, minSpacingPx: number): number[] {
  const span = w.to - w.from;
  if (widthPx <= 0 || span <= 0) return [];
  const step = niceStep((minSpacingPx / widthPx) * span);
  const out: number[] = [];
  for (let t = Math.ceil(w.from / step) * step; t <= w.to + 1e-9; t += step) {
    out.push(Math.round(t / step) * step);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/timeScale.test.ts`

Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/timeScale.ts packages/ui/src/components/Timeline/timeScale.test.ts
git commit -m "add the timeline editor's time scale and ruler ticks"
```

---

## Task 7: `lanes.ts`

**Files:**
- Create: `packages/ui/src/components/Timeline/lanes.ts`
- Create: `packages/ui/src/components/Timeline/lanes.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { Track } from '@weasel-js/core';
import { buildLanes, trackAtPath } from './lanes';

const sampled = (label: string, values: unknown[]): Track => ({
  kind: 'sampled',
  label,
  keys: values.map((value, i) => ({ t: i * 100, value })),
  onTick: () => {},
}) as Track;

const events = (label: string): Track => ({
  kind: 'event',
  label,
  events: [{ t: 50, fire: () => {} }],
}) as Track;

const nested = (label: string, at: number, children: Track[]): Track => ({
  kind: 'timeline',
  label,
  at,
  timeline: { tracks: children },
}) as Track;

describe('buildLanes', () => {
  it('makes one row per top-level track, in order', () => {
    const rows = buildLanes([sampled('x', [0, 1]), events('step')], new Set());
    expect(rows.map((r) => r.label)).toEqual(['x', 'step']);
    expect(rows.map((r) => r.depth)).toEqual([0, 0]);
  });

  it('labels an unlabelled track by its kind and index', () => {
    const t = { kind: 'sampled', keys: [], onTick: () => {} } as unknown as Track;
    expect(buildLanes([t], new Set())[0].label).toBe('sampled 0');
  });

  it('gives each row a stable path-derived key', () => {
    const rows = buildLanes([sampled('x', [0]), sampled('y', [0])], new Set());
    expect(rows.map((r) => r.key)).toEqual(['0', '1']);
  });

  it('hides a collapsed nested timeline’s children', () => {
    const rows = buildLanes([nested('blink', 200, [sampled('o', [0, 1])])], new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe('timeline');
  });

  it('shows an expanded nested timeline’s children one level deeper', () => {
    const rows = buildLanes([nested('blink', 200, [sampled('o', [0, 1])])], new Set(['0']));
    expect(rows.map((r) => r.label)).toEqual(['blink', 'o']);
    expect(rows.map((r) => r.depth)).toEqual([0, 1]);
    expect(rows.map((r) => r.key)).toEqual(['0', '0.0']);
  });

  it('accumulates the nested offset onto a child row', () => {
    const rows = buildLanes(
      [nested('outer', 200, [nested('inner', 50, [sampled('o', [0, 1])])])],
      new Set(['0', '0.0']),
    );
    expect(rows.map((r) => r.offset)).toEqual([0, 200, 250]);
  });

  it('marks an all-numeric sampled track as numeric', () => {
    expect(buildLanes([sampled('x', [0, 10])], new Set())[0].numeric).toBe(true);
  });

  it('does not mark a track with a non-numeric value as numeric', () => {
    expect(buildLanes([sampled('p', [{ x: 0 }, { x: 1 }])], new Set())[0].numeric).toBe(false);
  });

  it('does not mark an empty sampled track as numeric', () => {
    expect(buildLanes([sampled('empty', [])], new Set())[0].numeric).toBe(false);
  });

  it('never marks an event or nested row as numeric', () => {
    const rows = buildLanes([events('step'), nested('n', 0, [])], new Set());
    expect(rows.map((r) => r.numeric)).toEqual([false, false]);
  });
});

describe('trackAtPath', () => {
  it('finds a top-level track', () => {
    const tracks = [sampled('x', [0]), events('step')];
    expect(trackAtPath(tracks, [1])).toBe(tracks[1]);
  });

  it('descends into a nested timeline', () => {
    const child = sampled('o', [0]);
    const tracks = [nested('blink', 0, [child])];
    expect(trackAtPath(tracks, [0, 0])).toBe(child);
  });

  it('returns undefined for a path that does not exist', () => {
    expect(trackAtPath([sampled('x', [0])], [4])).toBeUndefined();
    expect(trackAtPath([sampled('x', [0])], [0, 0])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/lanes.test.ts`

Expected: FAIL — `Failed to resolve import "./lanes"`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SampledTrack, Track } from '@weasel-js/core';

export interface LaneRow {
  /** Stable across re-renders and edits: the dotted index path. */
  key: string;
  /** Index path into the track tree, outermost first. */
  path: number[];
  track: Track;
  label: string;
  /** Nesting depth; 0 for a top-level track. */
  depth: number;
  /** Accumulated `at` from every nested parent, in ms. A key drawn on this row
   *  sits at `offset + key.t` on the ruler. */
  offset: number;
  kind: Track['kind'];
  /** True only for a sampled track whose every key value is a number — the
   *  sole case where a value axis has an honest meaning. */
  numeric: boolean;
}

function isNumeric(track: Track): boolean {
  if (track.kind !== 'sampled') return false;
  const keys = (track as SampledTrack<unknown>).keys;
  return keys.length > 0 && keys.every((k) => typeof k.value === 'number');
}

/** Flatten the track tree to rows, descending only into expanded nested
 *  timelines. `expanded` holds the `key` of each open nested row. */
export function buildLanes(
  tracks: readonly Track[],
  expanded: ReadonlySet<string>,
): LaneRow[] {
  const out: LaneRow[] = [];
  const walk = (list: readonly Track[], path: number[], depth: number, offset: number): void => {
    list.forEach((track, i) => {
      const nextPath = [...path, i];
      const key = nextPath.join('.');
      out.push({
        key,
        path: nextPath,
        track,
        label: track.label ?? `${track.kind} ${i}`,
        depth,
        offset,
        kind: track.kind,
        numeric: isNumeric(track),
      });
      if (track.kind === 'timeline' && expanded.has(key)) {
        walk(track.timeline.tracks, nextPath, depth + 1, offset + track.at);
      }
    });
  };
  walk(tracks, [], 0, 0);
  return out;
}

/** The track at an index path, or `undefined` when the path leaves the tree. */
export function trackAtPath(tracks: readonly Track[], path: number[]): Track | undefined {
  let list: readonly Track[] = tracks;
  let found: Track | undefined;
  for (const i of path) {
    found = list[i];
    if (!found) return undefined;
    list = found.kind === 'timeline' ? found.timeline.tracks : [];
  }
  return found;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/lanes.test.ts`

Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/lanes.ts packages/ui/src/components/Timeline/lanes.test.ts
git commit -m "flatten a timeline's track tree into editor lane rows"
```

---

## Task 8: `keys.ts`

**Files:**
- Create: `packages/ui/src/components/Timeline/keys.ts`
- Create: `packages/ui/src/components/Timeline/keys.test.ts`

The trap this module exists to contain: `sampleTrack` binary-searches and **assumes keys are sorted
ascending, without sorting them**. Dragging a key past its neighbour must therefore re-sort and
report the moved key's new index, or the track silently samples wrong with no error anywhere.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import type { SampledTrack, Track } from '@weasel-js/core';
import { deleteKey, insertKey, moveKey, setKeyEasing, setKeyValue, snapTime } from './keys';

const track = (ts: number[]): Track => ({
  kind: 'sampled',
  label: 'x',
  keys: ts.map((t) => ({ t, value: t })),
  onTick: () => {},
}) as Track;

const times = (tracks: Track[], i = 0): number[] =>
  (tracks[i] as SampledTrack<number>).keys.map((k) => k.t);

describe('moveKey', () => {
  it('moves a key in time', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 150);
    expect(times(r.tracks)).toEqual([0, 150, 200]);
  });

  it('re-sorts when a key is dragged past its neighbour', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 250);
    expect(times(r.tracks)).toEqual([0, 200, 250]);
  });

  it('reports the moved key’s new index after a re-sort', () => {
    const r = moveKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 }, 250);
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 2 });
  });

  it('clamps a negative time to zero', () => {
    const r = moveKey([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, -50);
    expect(times(r.tracks)).toEqual([0, 0]);
  });

  it('does not mutate the input tracks', () => {
    const input = [track([0, 100, 200])];
    const before = times(input);
    moveKey(input, { trackIndex: 0, keyIndex: 1 }, 150);
    expect(times(input)).toEqual(before);
  });

  it('preserves the track’s callbacks by reference', () => {
    const input = [track([0, 100])];
    const r = moveKey(input, { trackIndex: 0, keyIndex: 1 }, 150);
    expect((r.tracks[0] as SampledTrack<number>).onTick)
      .toBe((input[0] as SampledTrack<number>).onTick);
  });

  it('moves an event track’s crossing', () => {
    const ev = { kind: 'event', label: 'step', events: [{ t: 10, fire: () => {} }] } as unknown as Track;
    const r = moveKey([ev], { trackIndex: 0, keyIndex: 0 }, 40);
    expect((r.tracks[0] as { events: { t: number }[] }).events[0].t).toBe(40);
  });

  it('leaves a nested timeline row alone', () => {
    const n = { kind: 'timeline', at: 0, timeline: { tracks: [] } } as unknown as Track;
    const r = moveKey([n], { trackIndex: 0, keyIndex: 0 }, 40);
    expect(r.tracks[0]).toBe(n);
  });
});

describe('insertKey', () => {
  it('inserts in sorted position', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect(times(r.tracks)).toEqual([0, 100, 200]);
  });

  it('selects the inserted key', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 1 });
  });

  it('seeds the new key with the track’s value at that time', () => {
    const r = insertKey([track([0, 200])], 0, 100);
    expect((r.tracks[0] as SampledTrack<number>).keys[1].value).toBeCloseTo(100, 6);
  });

  it('inserts into an empty track', () => {
    const r = insertKey([track([])], 0, 50);
    expect(times(r.tracks)).toEqual([50]);
  });
});

describe('deleteKey', () => {
  it('removes the key', () => {
    const r = deleteKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 });
    expect(times(r.tracks)).toEqual([0, 200]);
  });

  it('selects the previous key', () => {
    const r = deleteKey([track([0, 100, 200])], { trackIndex: 0, keyIndex: 1 });
    expect(r.selection).toEqual({ trackIndex: 0, keyIndex: 0 });
  });

  it('clears the selection when the last key goes', () => {
    const r = deleteKey([track([0])], { trackIndex: 0, keyIndex: 0 });
    expect(r.selection).toBeNull();
  });
});

describe('setKeyEasing', () => {
  it('writes a named easing', () => {
    const r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 'easeOutBack');
    expect((r[0] as SampledTrack<number>).keys[1].easing).toBe('easeOutBack');
  });

  it('writes bezier control points', () => {
    const spec = { bezier: [0.4, 0, 0.2, 1] } as const;
    const r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, spec);
    expect((r[0] as SampledTrack<number>).keys[1].easing).toEqual(spec);
  });

  it('clears easing when given undefined', () => {
    let r = setKeyEasing([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 'easeOutBack');
    r = setKeyEasing(r, { trackIndex: 0, keyIndex: 1 }, undefined);
    expect((r[0] as SampledTrack<number>).keys[1].easing).toBeUndefined();
  });
});

describe('setKeyValue', () => {
  it('writes the value without moving the key', () => {
    const r = setKeyValue([track([0, 100])], { trackIndex: 0, keyIndex: 1 }, 42);
    expect((r[0] as SampledTrack<number>).keys[1]).toMatchObject({ t: 100, value: 42 });
  });
});

describe('snapTime', () => {
  it('snaps to a candidate inside the tolerance', () => {
    expect(snapTime(103, [0, 100, 200], 6)).toBe(100);
  });

  it('leaves a time outside the tolerance alone', () => {
    expect(snapTime(150, [0, 100, 200], 6)).toBe(150);
  });

  it('picks the nearest of two candidates in range', () => {
    expect(snapTime(98, [95, 100], 6)).toBe(100);
  });

  it('returns the time unchanged with no candidates', () => {
    expect(snapTime(150, [], 6)).toBe(150);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/keys.test.ts`

Expected: FAIL — `Failed to resolve import "./keys"`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { sampleTrack, type EasingSpec, type EventTrack, type Keyframe, type SampledTrack, type Track } from '@weasel-js/core';

export interface KeySelection {
  trackIndex: number;
  keyIndex: number;
}

export interface KeyEdit {
  tracks: Track[];
  selection: KeySelection | null;
}

/** Shallow-clone one track, replacing only its key list. `onTick`, `fire`,
 *  `interpolate` and `interpolator` survive as references, which is what lets a
 *  running timeline take an edited track without rewiring. */
function withKeys(track: Track, keys: Keyframe<unknown>[]): Track {
  return { ...(track as SampledTrack<unknown>), keys } as Track;
}

function withEvents(track: Track, events: EventTrack['events']): Track {
  return { ...(track as EventTrack), events } as Track;
}

function replaceAt(tracks: readonly Track[], index: number, next: Track): Track[] {
  const out = tracks.slice();
  out[index] = next;
  return out;
}

/** Move a key or an event crossing to `toMs`, clamped at zero.
 *
 *  Re-sorts, and reports the moved entry's new index. `sampleTrack` binary-
 *  searches without sorting first, so a drag past a neighbour that left the list
 *  unsorted would sample the wrong segment and raise nothing. */
export function moveKey(
  tracks: readonly Track[], sel: KeySelection, toMs: number,
): KeyEdit {
  const track = tracks[sel.trackIndex];
  const t = Math.max(0, toMs);

  if (track?.kind === 'sampled') {
    const st = track as SampledTrack<unknown>;
    const moved = { ...st.keys[sel.keyIndex], t };
    const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
    const at = keys.findIndex((k) => k.t > t);
    const keyIndex = at === -1 ? keys.length : at;
    keys.splice(keyIndex, 0, moved);
    return {
      tracks: replaceAt(tracks, sel.trackIndex, withKeys(track, keys)),
      selection: { trackIndex: sel.trackIndex, keyIndex },
    };
  }

  if (track?.kind === 'event') {
    const et = track as EventTrack;
    const moved = { ...et.events[sel.keyIndex], t };
    const events = et.events.filter((_, i) => i !== sel.keyIndex);
    const at = events.findIndex((e) => e.t > t);
    const keyIndex = at === -1 ? events.length : at;
    events.splice(keyIndex, 0, moved);
    return {
      tracks: replaceAt(tracks, sel.trackIndex, withEvents(track, events)),
      selection: { trackIndex: sel.trackIndex, keyIndex },
    };
  }

  return { tracks: tracks.slice(), selection: sel };
}

/** Insert a key at `atMs`, seeded with whatever the track already reads there
 *  so inserting alone never changes the motion. */
export function insertKey(
  tracks: readonly Track[], trackIndex: number, atMs: number,
): KeyEdit {
  const track = tracks[trackIndex];
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: null };

  const st = track as SampledTrack<unknown>;
  const t = Math.max(0, atMs);
  const value = st.keys.length === 0 ? 0 : sampleTrack(st, t);
  const keys = st.keys.slice();
  const at = keys.findIndex((k) => k.t > t);
  const keyIndex = at === -1 ? keys.length : at;
  keys.splice(keyIndex, 0, { t, value });
  return {
    tracks: replaceAt(tracks, trackIndex, withKeys(track, keys)),
    selection: { trackIndex, keyIndex },
  };
}

/** Remove a key, selecting the one before it. */
export function deleteKey(tracks: readonly Track[], sel: KeySelection): KeyEdit {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return { tracks: tracks.slice(), selection: sel };

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.filter((_, i) => i !== sel.keyIndex);
  return {
    tracks: replaceAt(tracks, sel.trackIndex, withKeys(track, keys)),
    selection: keys.length === 0
      ? null
      : { trackIndex: sel.trackIndex, keyIndex: Math.max(0, sel.keyIndex - 1) },
  };
}

/** Set the easing shaping the approach INTO the selected key. */
export function setKeyEasing(
  tracks: readonly Track[], sel: KeySelection, easing: EasingSpec | undefined,
): Track[] {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  const { easing: _drop, ...rest } = keys[sel.keyIndex];
  keys[sel.keyIndex] = easing === undefined ? rest : { ...rest, easing };
  return replaceAt(tracks, sel.trackIndex, withKeys(track, keys));
}

/** Set the selected key's value, leaving its time alone. */
export function setKeyValue(
  tracks: readonly Track[], sel: KeySelection, value: unknown,
): Track[] {
  const track = tracks[sel.trackIndex];
  if (track?.kind !== 'sampled') return tracks.slice();

  const st = track as SampledTrack<unknown>;
  const keys = st.keys.slice();
  keys[sel.keyIndex] = { ...keys[sel.keyIndex], value };
  return replaceAt(tracks, sel.trackIndex, withKeys(track, keys));
}

/** Snap `ms` to the nearest candidate within `toleranceMs`, else return it. */
export function snapTime(ms: number, candidates: readonly number[], toleranceMs: number): number {
  let best = ms;
  let bestDist = toleranceMs;
  for (const c of candidates) {
    const d = Math.abs(c - ms);
    if (d <= bestDist) {
      best = c;
      bestDist = d;
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/keys.test.ts`

Expected: PASS — 22 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/keys.ts packages/ui/src/components/Timeline/keys.test.ts
git commit -m "add the timeline editor's keyframe edit algebra"
```

---

## Task 9: `easingSpec.ts` (ui side)

**Files:**
- Create: `packages/ui/src/components/Timeline/easingSpec.ts`
- Create: `packages/ui/src/components/Timeline/easingSpec.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { easeOutBack } from '@weasel-js/core';
import { easingBezier, easingLabel, sampleEasing } from './easingSpec';

describe('easingLabel', () => {
  it('labels no easing as linear', () => {
    expect(easingLabel(undefined)).toBe('linear');
  });

  it('labels a name as itself', () => {
    expect(easingLabel('easeOutBack')).toBe('easeOutBack');
  });

  it('labels a bezier by its control points', () => {
    expect(easingLabel({ bezier: [0.4, 0, 0.2, 1] })).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
  });

  it('recovers the name of a built-in passed as a function', () => {
    expect(easingLabel(easeOutBack)).toBe('easeOutBack');
  });

  it('labels an unrecognized function as custom', () => {
    expect(easingLabel((t: number) => t * t)).toBe('custom');
  });
});

describe('easingBezier', () => {
  it('returns the control points of a bezier spec', () => {
    expect(easingBezier({ bezier: [0.4, 0, 0.2, 1] })).toEqual([0.4, 0, 0.2, 1]);
  });

  it('returns null for anything without control points', () => {
    expect(easingBezier(undefined)).toBeNull();
    expect(easingBezier('easeOutBack')).toBeNull();
    expect(easingBezier((t: number) => t)).toBeNull();
  });
});

describe('sampleEasing', () => {
  it('returns the requested number of samples', () => {
    expect(sampleEasing('easeInQuad', 11)).toHaveLength(11);
  });

  it('spans 0 to 1 at the ends', () => {
    const s = sampleEasing('easeInQuad', 11);
    expect(s[0]).toBeCloseTo(0, 6);
    expect(s[10]).toBeCloseTo(1, 6);
  });

  it('samples the curve, not the input', () => {
    // easeInQuad at 0.5 is 0.25.
    expect(sampleEasing('easeInQuad', 3)[1]).toBeCloseTo(0.25, 6);
  });

  it('samples undefined as linear', () => {
    expect(sampleEasing(undefined, 3)[1]).toBeCloseTo(0.5, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/easingSpec.test.ts`

Expected: FAIL — `Failed to resolve import "./easingSpec"`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { EASINGS, resolveEasing, type EasingName, type EasingSpec } from '@weasel-js/core';

function bezierOf(spec: EasingSpec): [number, number, number, number] | null {
  if (typeof spec === 'object' && spec !== null && 'bezier' in spec) return spec.bezier;
  return null;
}

/** Control points, for the graph view's draggable handles. `null` means this
 *  spec has no handles to drag — the view offers to convert it to a bezier. */
export function easingBezier(spec?: EasingSpec): [number, number, number, number] | null {
  if (spec === undefined) return null;
  return bezierOf(spec);
}

/** What the picker shows for a spec.
 *
 *  A function is matched against the built-ins by reference so a consumer that
 *  passed `easeOutBack` directly still reads back as `'easeOutBack'`. A wrapped
 *  or hand-written function cannot be named and reads as `'custom'` — which is
 *  why an editor writes names and control points rather than functions. */
export function easingLabel(spec?: EasingSpec): string {
  if (spec === undefined) return 'linear';
  if (typeof spec === 'string') return spec;
  const b = bezierOf(spec);
  if (b) return `cubic-bezier(${b.join(', ')})`;
  for (const [name, fn] of Object.entries(EASINGS)) {
    if (fn === spec) return name;
  }
  return 'custom';
}

/** `count` evenly spaced samples of the curve over 0..1, for drawing it. */
export function sampleEasing(spec: EasingSpec | undefined, count: number): number[] {
  const fn = resolveEasing(spec);
  const out = new Array<number>(count);
  const last = count - 1;
  for (let i = 0; i < count; i++) out[i] = fn(last === 0 ? 0 : i / last);
  return out;
}

/** Every built-in name, for the picker's list. */
export const EASING_NAMES = Object.keys(EASINGS) as EasingName[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/easingSpec.test.ts`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/easingSpec.ts packages/ui/src/components/Timeline/easingSpec.test.ts
git commit -m "name, sample and unpack an easing spec for the editor"
```

---

## Task 10: `Ruler.tsx` — ticks, playhead, scrub

**Files:**
- Create: `packages/ui/src/components/Timeline/Ruler.tsx`
- Create: `packages/ui/src/components/Timeline/Ruler.test.tsx`
- Create: `packages/ui/src/components/Timeline/Timeline.module.css`

**Drag idiom — follow `BandEditor` exactly.** Attach `pointermove` / `pointerup` / `pointercancel`
to `document` on pointerdown and remove them on release. **Do not call `setPointerCapture`.** In a
browser, capture on pointerdown retargets `pointerup` and kills the synthesized `click` on every
non-native child — the `FloatingPanel` defect. In jsdom `setPointerCapture` exists, records the
call and does nothing else, so a test written to catch that cannot fail. The guard below asserts
the call never happens, which is a proxy on this side of the boundary and says so.

jsdom reports a zero-width rect for everything, so every test in this file stubs
`getBoundingClientRect` — otherwise every ms↔px conversion divides by zero and the assertions pass
vacuously.

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Ruler } from './Ruler';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 24,
      width: TRACK_WIDTH, height: 24, toJSON: () => {},
    } as DOMRect;
  };
});

const props = {
  window: { from: 0, to: 1000 },
  bounds: { from: 0, to: 1000 },
  playhead: 250,
  onScrub: () => {},
  onWindowChange: () => {},
};

const ruler = (): HTMLElement => screen.getByTestId('timeline-ruler');

describe('Ruler', () => {
  it('renders tick labels', () => {
    render(<Ruler {...props} />);
    expect(screen.getAllByTestId('timeline-tick').length).toBeGreaterThan(1);
  });

  it('positions the playhead at its fraction of the window', () => {
    render(<Ruler {...props} />);
    expect(screen.getByTestId('timeline-playhead')).toHaveStyle({ left: '25%' });
  });

  it('scrubs to the pointer on pointerdown', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(200);
  });

  it('scrubs continuously through a drag', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 5 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 5 });
    expect(onScrub).toHaveBeenLastCalledWith(600);
  });

  it('stops scrubbing after pointerup', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 5 });
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5 });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('stops scrubbing after pointercancel', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerCancel(document, {});
    onScrub.mockClear();
    fireEvent.pointerMove(document, { clientX: 400, clientY: 5 });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('clamps a scrub past the end of the window', () => {
    const onScrub = vi.fn();
    render(<Ruler {...props} onScrub={onScrub} />);
    fireEvent.pointerDown(ruler(), { clientX: 900, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(1000);
  });

  // PROXY ASSERTION. jsdom's setPointerCapture records the call and has no other
  // consequence, so a test asserting the drag still works would pass either way.
  // What actually breaks in a browser is capture killing the click on non-native
  // children, which jsdom cannot show. Asserting the call never happens is the
  // check that can fail on this side of the boundary.
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    render(<Ruler {...props} />);
    fireEvent.pointerDown(ruler(), { clientX: 100, clientY: 5, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 5 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 5 });
    expect(capture).not.toHaveBeenCalled();
  });

  it('zooms in on a wheel with ctrl held', () => {
    const onWindowChange = vi.fn();
    render(<Ruler {...props} onWindowChange={onWindowChange} />);
    fireEvent.wheel(ruler(), { deltaY: -100, ctrlKey: true, clientX: 250 });
    const next = onWindowChange.mock.calls[0][0];
    expect(next.to - next.from).toBeLessThan(1000);
  });

  it('pans on a plain wheel', () => {
    const onWindowChange = vi.fn();
    render(<Ruler {...props} window={{ from: 200, to: 700 }} onWindowChange={onWindowChange} />);
    fireEvent.wheel(ruler(), { deltaY: 100, clientX: 250 });
    const next = onWindowChange.mock.calls[0][0];
    expect(next.to - next.from).toBeCloseTo(500, 6);
    expect(next.from).not.toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Ruler.test.tsx`

Expected: FAIL — `Failed to resolve import "./Ruler"`.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/components/Timeline/Ruler.tsx`:

```tsx
import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactElement, type WheelEvent as ReactWheelEvent } from 'react';
import s from './Timeline.module.css';
import { createTimeScale, panWindow, tickTimes, zoomWindow, type TimeWindow } from './timeScale';

/** Minimum gap between ruler ticks, in px. */
const TICK_SPACING_PX = 64;

/** One wheel notch's zoom factor. */
const ZOOM_STEP = 0.0015;

export interface RulerProps {
  window: TimeWindow;
  /** The full extent the window may cover — normally `{ from: 0, to: duration }`. */
  bounds: TimeWindow;
  playhead: number;
  onScrub: (t: number) => void;
  onWindowChange: (w: TimeWindow) => void;
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)}s`;
  return `${Math.round(ms)}ms`;
}

export function Ruler(props: RulerProps): ReactElement {
  const { window: win, bounds, playhead, onScrub, onWindowChange } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDragRef.current?.(); }, []);

  const widthOf = (): number => trackRef.current?.getBoundingClientRect().width ?? 0;
  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return win.from;
    const scale = createTimeScale(win, rect.width);
    const raw = scale.toMs(clientX - rect.left);
    return Math.min(win.to, Math.max(win.from, raw));
  };

  // Document listeners, never setPointerCapture: capture retargets pointerup and
  // kills the click on non-native children. See BandEditor, same idiom.
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    onScrub(msAt(e.clientX));

    const move = (ev: PointerEvent): void => { onScrub(msAt(ev.clientX)); };
    const end = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', end);
      document.removeEventListener('pointercancel', end);
      endDragRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    endDragRef.current = end;
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    if (e.ctrlKey) {
      onWindowChange(zoomWindow(win, msAt(e.clientX), Math.exp(e.deltaY * ZOOM_STEP), bounds));
    } else {
      const width = widthOf();
      const perPx = width === 0 ? 0 : (win.to - win.from) / width;
      onWindowChange(panWindow(win, e.deltaY * perPx, bounds));
    }
  };

  const scale = createTimeScale(win, widthOf());
  const ticks = tickTimes(win, widthOf(), TICK_SPACING_PX);
  const span = win.to - win.from;
  const pct = (ms: number): string => `${span === 0 ? 0 : ((ms - win.from) / span) * 100}%`;

  return (
    <div
      className={s.ruler}
      ref={trackRef}
      data-testid="timeline-ruler"
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      {ticks.map((t) => (
        <span
          key={t}
          className={s.tick}
          data-testid="timeline-tick"
          style={{ left: pct(t) }}
        >
          {formatMs(t)}
        </span>
      ))}
      <div
        className={s.playhead}
        data-testid="timeline-playhead"
        style={{ left: pct(playhead) }}
      />
    </div>
  );
}
```

Note there is no `scale` binding in the render — `pct` computes the percentage directly, and
`createTimeScale` is used only inside `msAt`. Do not add one; an unused binding fails lint.

The ruler's positional styles are the one place inline `style` is warranted — a percentage computed
per render has no class to live in. Everything else goes in the CSS module.

Create `packages/ui/src/components/Timeline/Timeline.module.css` with the ruler rules:

```css
.ruler {
  position: relative;
  height: var(--wzl-control-h, 24px);
  border-bottom: 1px solid var(--wzl-border);
  background: var(--wzl-surface-2);
  cursor: ew-resize;
  user-select: none;
  overflow: hidden;
}

.tick {
  position: absolute;
  top: 0;
  transform: translateX(2px);
  font-size: var(--wzl-font-xs, 10px);
  color: var(--wzl-text-muted);
  pointer-events: none;
  white-space: nowrap;
}

.tick::before {
  content: '';
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--wzl-border);
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--wzl-accent);
  pointer-events: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Ruler.test.tsx`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/Ruler.tsx packages/ui/src/components/Timeline/Ruler.test.tsx packages/ui/src/components/Timeline/Timeline.module.css
git commit -m "add the timeline editor's ruler, playhead and scrub"
```

---

## Task 11: `Lane.tsx` — dope-sheet rows and key dragging

**Files:**
- Create: `packages/ui/src/components/Timeline/Lane.tsx`
- Create: `packages/ui/src/components/Timeline/Lane.test.tsx`
- Modify: `packages/ui/src/components/Timeline/Timeline.module.css`

A key is a `<div role="button" tabIndex={0}>`, not a `<button>`: these sit in a row beside text and
a `<button>` is an atomic inline-block that reports its last line's baseline. Role, name and
keyboard operability are what WCAG asks for, and the div carries all three.

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { Track } from '@weasel-js/core';
import { Lane } from './Lane';
import { buildLanes } from './lanes';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

const sampled: Track = {
  kind: 'sampled', label: 'x',
  keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }],
  onTick: () => {},
} as Track;

const eventTrack: Track = {
  kind: 'event', label: 'step',
  events: [{ t: 250, fire: () => {} }],
} as Track;

const base = {
  window: { from: 0, to: 1000 },
  mode: 'dope' as const,
  selection: null,
  onSelect: () => {},
  onKeyInput: () => {},
  onKeyCommit: () => {},
  onInsert: () => {},
  onToggleExpand: () => {},
  expanded: false,
  snapTimes: [] as number[],
};

const laneOf = (t: Track) => buildLanes([t], new Set())[0];

describe('Lane', () => {
  it('renders one key per sampled keyframe', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('names each key for a screen reader', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByRole('button')[0]).toHaveAccessibleName(/x.*0\s*ms/i);
  });

  it('positions a key at its fraction of the window', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-key')[1]).toHaveStyle({ left: '50%' });
  });

  it('renders event crossings as markers', () => {
    render(<Lane {...base} row={laneOf(eventTrack)} />);
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(1);
  });

  it('selects a key on pointerdown', () => {
    const onSelect = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelect={onSelect} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('reports live times through the drag and one commit at its end', () => {
    const onKeyInput = vi.fn();
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onKeyInput={onKeyInput} onKeyCommit={onKeyCommit} />);
    const key = screen.getAllByTestId('timeline-key')[1];
    fireEvent.pointerDown(key, { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    fireEvent.pointerMove(document, { clientX: 350, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 350, clientY: 10 });
    expect(onKeyInput).toHaveBeenCalledTimes(2);
    expect(onKeyCommit).toHaveBeenCalledTimes(1);
    expect(onKeyCommit).toHaveBeenCalledWith(1, 700);
  });

  it('snaps a dragged key to a nearby snap time', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10 });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 600);
  });

  it('lets alt defeat snapping for the drag', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} snapTimes={[600]} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0, altKey: true });
    fireEvent.pointerMove(document, { clientX: 301, clientY: 10, altKey: true });
    fireEvent.pointerUp(document, { clientX: 301, clientY: 10, altKey: true });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 602);
  });

  it('inserts a key on double-click', () => {
    const onInsert = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onInsert={onInsert} />);
    fireEvent.doubleClick(screen.getByTestId('timeline-lane-track'), { clientX: 100 });
    expect(onInsert).toHaveBeenCalledWith(200);
  });

  it('moves a focused key with the arrow keys', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyCommit={onKeyCommit} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight' });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 510);
  });

  it('takes a bigger arrow step with shift', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} selection={1} onKeyCommit={onKeyCommit} />);
    fireEvent.keyDown(screen.getAllByTestId('timeline-key')[1], { key: 'ArrowRight', shiftKey: true });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 600);
  });

  // PROXY ASSERTION — see Ruler.test.tsx for why this is asserted rather than
  // the browser behaviour it stands in for.
  it('never captures the pointer', () => {
    const capture = vi.fn();
    Element.prototype.setPointerCapture = capture;
    render(<Lane {...base} row={laneOf(sampled)} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerMove(document, { clientX: 300, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 300, clientY: 10 });
    expect(capture).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Lane.test.tsx`

Expected: FAIL — `Failed to resolve import "./Lane"`.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/components/Timeline/Lane.tsx`:

```tsx
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { EventTrack, SampledTrack } from '@weasel-js/core';
import s from './Timeline.module.css';
import { createTimeScale, type TimeWindow } from './timeScale';
import { snapTime } from './keys';
import type { LaneRow } from './lanes';

/** Snap radius, in track pixels. */
const SNAP_PX = 6;

/** One arrow-key step, in ms; shift multiplies by ten. */
const KEY_STEP_MS = 10;

export interface LaneProps {
  row: LaneRow;
  window: TimeWindow;
  mode: 'dope' | 'graph';
  /** Index of the selected key on THIS row, or null. */
  selection: number | null;
  onSelect: (keyIndex: number) => void;
  /** Live during a drag. */
  onKeyInput: (keyIndex: number, toMs: number) => void;
  /** Once, at the end of a gesture. */
  onKeyCommit: (keyIndex: number, toMs: number) => void;
  onInsert: (atMs: number) => void;
  onToggleExpand: () => void;
  expanded: boolean;
  /** Times a dragged key snaps to. */
  snapTimes: readonly number[];
}

function entryTimes(row: LaneRow): number[] {
  if (row.kind === 'sampled') return (row.track as SampledTrack<unknown>).keys.map((k) => k.t);
  if (row.kind === 'event') return (row.track as EventTrack).events.map((e) => e.t);
  return [];
}

export function Lane(props: LaneProps): ReactElement {
  const { row, window: win, selection, onSelect, onKeyInput, onKeyCommit, onInsert, onToggleExpand, expanded, snapTimes } = props;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const endDragRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { endDragRef.current?.(); }, []);

  const span = win.to - win.from;
  const pct = (ms: number): string => `${span === 0 ? 0 : ((ms + row.offset - win.from) / span) * 100}%`;

  const msAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return win.from;
    return createTimeScale(win, rect.width).toMs(clientX - rect.left) - row.offset;
  };

  const snapPxToMs = (): number => {
    const width = trackRef.current?.getBoundingClientRect().width ?? 0;
    return width === 0 ? 0 : (SNAP_PX / width) * span;
  };

  const onKeyPointerDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(i);

    const at = (ev: { clientX: number; altKey: boolean }): number => {
      const raw = Math.max(0, msAt(ev.clientX));
      return ev.altKey ? raw : snapTime(raw, snapTimes, snapPxToMs());
    };

    const move = (ev: PointerEvent): void => { onKeyInput(i, at(ev)); };
    const up = (ev: PointerEvent): void => { onKeyCommit(i, at(ev)); end(); };
    const end = (): void => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', end);
      endDragRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', end);
    endDragRef.current = end;
  };

  const onKeyDown = (i: number, t: number) => (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    const step = KEY_STEP_MS * (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowRight') { e.preventDefault(); onKeyCommit(i, t + step); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onKeyCommit(i, Math.max(0, t - step)); }
  };

  const times = entryTimes(row);

  return (
    <div className={s.lane} data-depth={row.depth}>
      <div className={s.laneLabel}>
        {row.kind === 'timeline' ? (
          <span
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            className={s.disclosure}
            onClick={onToggleExpand}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
          >
            {expanded ? '▾' : '▸'}
          </span>
        ) : null}
        {row.label}
      </div>
      <div
        className={s.laneTrack}
        ref={trackRef}
        data-testid="timeline-lane-track"
        onDoubleClick={(e) => { if (row.kind === 'sampled') onInsert(Math.max(0, msAt(e.clientX))); }}
      >
        {row.kind === 'timeline' ? (
          <div
            className={s.nestedBar}
            data-testid="timeline-nested"
            style={{ left: pct(0), width: `${span === 0 ? 0 : (row.track.timeline.duration ?? 0) / span * 100}%` }}
          />
        ) : null}
        {times.map((t, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            aria-label={`${row.label} key at ${Math.round(t)} ms`}
            aria-current={selection === i ? 'true' : undefined}
            data-testid={row.kind === 'event' ? 'timeline-event' : 'timeline-key'}
            className={row.kind === 'event' ? s.eventMark : s.key}
            style={{ left: pct(t) }}
            onPointerDown={onKeyPointerDown(i)}
            onKeyDown={onKeyDown(i, t)}
          />
        ))}
      </div>
    </div>
  );
}
```

Append to `Timeline.module.css`:

```css
.lane {
  display: flex;
  align-items: stretch;
  min-height: 20px;
  border-bottom: 1px solid var(--wzl-border-subtle);
}

.laneLabel {
  flex: 0 0 var(--wzl-timeline-label-w, 120px);
  display: flex;
  align-items: center;
  gap: 4px;
  padding-inline: 6px;
  padding-inline-start: calc(6px + var(--depth, 0) * 12px);
  font-size: var(--wzl-font-xs, 10px);
  color: var(--wzl-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lane[data-depth='1'] .laneLabel { --depth: 1; }
.lane[data-depth='2'] .laneLabel { --depth: 2; }
.lane[data-depth='3'] .laneLabel { --depth: 3; }

.disclosure { cursor: pointer; color: var(--wzl-text-muted); }

.laneTrack {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  background: var(--wzl-surface-1);
}

.key, .eventMark {
  position: absolute;
  top: 50%;
  width: 9px;
  height: 9px;
  margin-left: -4.5px;
  background: var(--wzl-text-muted);
  cursor: ew-resize;
}

.key { transform: translateY(-50%) rotate(45deg); }
.eventMark { transform: translateY(-50%); border-radius: 50%; }

.key[aria-current='true'], .eventMark[aria-current='true'] { background: var(--wzl-accent); }
.key:focus-visible, .eventMark:focus-visible { outline: 2px solid var(--wzl-focus); outline-offset: 1px; }

.nestedBar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  background: var(--wzl-surface-3);
  border: 1px solid var(--wzl-border);
  border-radius: 2px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Lane.test.tsx`

Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/Lane.tsx packages/ui/src/components/Timeline/Lane.test.tsx packages/ui/src/components/Timeline/Timeline.module.css
git commit -m "add the timeline editor's dope-sheet lane"
```

---

## Task 12: `Transport.tsx`

**Files:**
- Create: `packages/ui/src/components/Timeline/Transport.tsx`
- Create: `packages/ui/src/components/Timeline/Transport.test.tsx`
- Modify: `packages/ui/src/components/Timeline/Timeline.module.css`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { Transport } from './Transport';

const props = {
  paused: true,
  loop: false as boolean | number,
  rate: 1,
  playhead: 0,
  duration: 2000,
  onPlay: () => {},
  onPause: () => {},
  onLoopChange: () => {},
  onRateChange: () => {},
};

describe('Transport', () => {
  it('shows play while paused', () => {
    render(<Transport {...props} />);
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
  });

  it('shows pause while running', () => {
    render(<Transport {...props} paused={false} />);
    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('calls onPlay when play is pressed', () => {
    const onPlay = vi.fn();
    render(<Transport {...props} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls onPause when pause is pressed', () => {
    const onPause = vi.fn();
    render(<Transport {...props} paused={false} onPause={onPause} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('reads out the playhead against the duration', () => {
    render(<Transport {...props} playhead={480} />);
    expect(screen.getByTestId('timeline-time')).toHaveTextContent('0.48s / 2.00s');
  });

  it('reflects the loop state on the toggle', () => {
    render(<Transport {...props} loop />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  it('turns looping on', () => {
    const onLoopChange = vi.fn();
    render(<Transport {...props} onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(true);
  });

  it('turns looping off', () => {
    const onLoopChange = vi.fn();
    render(<Transport {...props} loop onLoopChange={onLoopChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(onLoopChange).toHaveBeenCalledWith(false);
  });

  it('treats a finite lap count as looping', () => {
    render(<Transport {...props} loop={3} />);
    expect(screen.getByRole('switch', { name: /loop/i })).toBeChecked();
  });

  it('changes the rate', () => {
    const onRateChange = vi.fn();
    render(<Transport {...props} onRateChange={onRateChange} />);
    fireEvent.change(screen.getByLabelText(/rate/i), { target: { value: '2' } });
    expect(onRateChange).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Transport.test.tsx`

Expected: FAIL — `Failed to resolve import "./Transport"`.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/components/Timeline/Transport.tsx`:

```tsx
import type { ReactElement } from 'react';
import s from './Timeline.module.css';

/** Playback rates the transport offers. */
const RATES = [0.25, 0.5, 1, 2, 4] as const;

export interface TransportProps {
  paused: boolean;
  loop: boolean | number;
  rate: number;
  playhead: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onLoopChange: (loop: boolean | number) => void;
  onRateChange: (rate: number) => void;
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export function Transport(props: TransportProps): ReactElement {
  const { paused, loop, rate, playhead, duration, onPlay, onPause, onLoopChange, onRateChange } = props;
  const looping = loop !== false && loop !== 0;

  return (
    <div className={s.transport}>
      <button
        type="button"
        className={s.transportButton}
        aria-label={paused ? 'Play' : 'Pause'}
        onClick={paused ? onPlay : onPause}
      >
        {paused ? '▶' : '❚❚'}
      </button>

      <span className={s.time} data-testid="timeline-time">
        {seconds(playhead)} / {seconds(duration)}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={looping}
        aria-label="Loop"
        className={s.transportButton}
        onClick={() => onLoopChange(!looping)}
      >
        ⟲
      </button>

      <label className={s.rate}>
        Rate
        <select value={rate} onChange={(e) => onRateChange(Number(e.target.value))}>
          {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
    </div>
  );
}
```

A `<select>` carries role, name and keyboard operability natively, so it is the right control for
rate. The play and loop controls are real `<button>`s — they hold a glyph, not a run of body text,
so the baseline trap does not apply.

Append to `Timeline.module.css`:

```css
.transport {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--wzl-border);
  background: var(--wzl-surface-2);
  font-size: var(--wzl-font-xs, 10px);
}

.transportButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  padding: 2px 4px;
  background: transparent;
  border: 1px solid var(--wzl-border);
  border-radius: 3px;
  color: var(--wzl-text);
  cursor: pointer;
}

.transportButton[aria-checked='true'] {
  background: var(--wzl-accent-soft);
  border-color: var(--wzl-accent);
  color: var(--wzl-accent);
}

.time { font-variant-numeric: tabular-nums; color: var(--wzl-text-muted); }
.rate { display: inline-flex; align-items: center; gap: 4px; color: var(--wzl-text-muted); }
```

`theme/base.less` sets `height: var(--wzl-control-h)` on bare `button` inside `:where()`. That
carries no specificity, so `.transportButton`'s own padding wins — but check the rendered height in
the screenshot step of Task 14 rather than assuming, because this rule has crushed glyph buttons
before.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Transport.test.tsx`

Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/Transport.tsx packages/ui/src/components/Timeline/Transport.test.tsx packages/ui/src/components/Timeline/Timeline.module.css
git commit -m "add the timeline editor's transport"
```

---

## Task 13: `Timeline.tsx` — the pure controlled component

**Files:**
- Create: `packages/ui/src/components/Timeline/Timeline.tsx`
- Create: `packages/ui/src/components/Timeline/Timeline.test.tsx`
- Modify: `packages/ui/src/components/Timeline/Timeline.module.css`

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, Track } from '@weasel-js/core';
import { Timeline } from './Timeline';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

const tracks = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} },
  { kind: 'event', label: 'step', events: [{ t: 250, fire: () => {} }] },
] as Track[]);

const base = {
  duration: 1000,
  playhead: 0,
  onChange: () => {},
  onScrub: () => {},
};

describe('Timeline', () => {
  it('renders one lane per track', () => {
    render(<Timeline {...base} tracks={tracks()} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });

  it('renders the transport by default', () => {
    render(<Timeline {...base} tracks={tracks()} />);
    expect(screen.getByTestId('timeline-time')).toBeInTheDocument();
  });

  it('hides the transport when told to', () => {
    render(<Timeline {...base} tracks={tracks()} transport={false} />);
    expect(screen.queryByTestId('timeline-time')).not.toBeInTheDocument();
  });

  it('commits a dragged key once, with the track re-sorted', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    const key = screen.getAllByTestId('timeline-key')[0];
    fireEvent.pointerDown(key, { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 400, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys.map((k) => k.t)).toEqual([500, 800]);
  });

  it('reports live positions through onInput without committing', () => {
    const onInput = vi.fn();
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onInput={onInput} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 10 });
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('preserves a track’s callbacks across an edit', () => {
    const input = tracks();
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={input} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[0], { clientX: 0, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 10 });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).onTick).toBe((input[0] as SampledTrack<number>).onTick);
  });

  it('scrubs from the ruler', () => {
    const onScrub = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onScrub={onScrub} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(onScrub).toHaveBeenCalledWith(500);
  });

  it('deletes the selected key on Delete', () => {
    const onChange = vi.fn();
    render(<Timeline {...base} tracks={tracks()} onChange={onChange} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.keyDown(screen.getByTestId('timeline-root'), { key: 'Delete' });
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys).toHaveLength(1);
  });

  it('renders the consumer’s key editor for the selection', () => {
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        renderKeyEditor={({ key }) => <span data-testid="key-editor">{String(key.value)}</span>}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    expect(screen.getByTestId('key-editor')).toHaveTextContent('10');
  });

  it('commits a value written through the key editor', () => {
    const onChange = vi.fn();
    render(
      <Timeline
        {...base}
        tracks={tracks()}
        onChange={onChange}
        renderKeyEditor={({ commit, key }) => (
          <button type="button" onClick={() => commit({ ...key, value: 42 })}>set</button>
        )}
      />,
    );
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, button: 0 });
    fireEvent.pointerUp(document, { clientX: 250 });
    onChange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'set' }));
    const next = onChange.mock.calls[0][0] as Track[];
    expect((next[0] as SampledTrack<number>).keys[1].value).toBe(42);
  });

  it('expands a nested timeline to show its children', () => {
    const nested = [{
      kind: 'timeline', label: 'blink', at: 100,
      timeline: { tracks: [{ kind: 'sampled', label: 'o', keys: [{ t: 0, value: 0 }], onTick: () => {} }] },
    }] as unknown as Track[];
    render(<Timeline {...base} tracks={nested} />);
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: '' , hidden: true }) ?? screen.getByText('▸'));
    expect(screen.getAllByTestId('timeline-lane-track')).toHaveLength(2);
  });
});
```

If the disclosure query above proves brittle, give the disclosure `data-testid="timeline-disclosure"`
in `Lane.tsx` and select on that instead — do not weaken the assertion to make it pass.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Timeline.test.tsx`

Expected: FAIL — `Failed to resolve import "./Timeline"`.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/components/Timeline/Timeline.tsx`:

```tsx
import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import type { EasingSpec, Keyframe, SampledTrack, Track } from '@weasel-js/core';
import s from './Timeline.module.css';
import { Lane } from './Lane';
import { Ruler } from './Ruler';
import { Transport, type TransportProps } from './Transport';
import { buildLanes, type LaneRow } from './lanes';
import { deleteKey, insertKey, moveKey, setKeyEasing, setKeyValue, type KeySelection } from './keys';
import type { TimeWindow } from './timeScale';

export type { KeySelection } from './keys';
export type { TimeWindow } from './timeScale';

export interface KeyEditorCtx<T = unknown> {
  key: Keyframe<T>;
  track: SampledTrack<T>;
  selection: KeySelection;
  /** Replace the selected key; routed through this component's `onChange`. */
  commit: (next: Keyframe<T>) => void;
  /** Set the easing shaping the approach into this key. */
  setEasing: (easing: EasingSpec | undefined) => void;
}

export interface TimelineProps {
  tracks: readonly Track[];
  duration: number;
  playhead: number;

  mode?: 'dope' | 'graph';
  onModeChange?: (mode: 'dope' | 'graph') => void;

  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: Track[]) => void;
  /** Committed at gesture end: one call per gesture. */
  onChange: (next: Track[]) => void;
  onScrub: (t: number) => void;

  /** `false` hides the transport. */
  transport?: Omit<TransportProps, 'playhead' | 'duration'> | false;
  selection?: KeySelection | null;
  onSelect?: (sel: KeySelection | null) => void;
  renderKeyEditor?: (ctx: KeyEditorCtx) => ReactNode;

  window?: TimeWindow;
  onWindowChange?: (w: TimeWindow) => void;

  label?: ReactNode;
  className?: string;
}

/** The flat index a lane row occupies among the top-level tracks, or -1 for a
 *  nested row. Editing a nested track's keys is a later change; nested rows are
 *  read-only for now and their keys do not drag. */
function topLevelIndex(row: LaneRow): number {
  return row.path.length === 1 ? row.path[0] : -1;
}

export function Timeline(props: TimelineProps): ReactElement {
  const {
    tracks, duration, playhead,
    onInput, onChange, onScrub,
    renderKeyEditor, label, className,
  } = props;

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [ownWindow, setOwnWindow] = useState<TimeWindow>({ from: 0, to: duration });
  const [ownSelection, setOwnSelection] = useState<KeySelection | null>(null);

  const win = props.window ?? ownWindow;
  const setWindow = props.onWindowChange ?? setOwnWindow;
  const selection = props.selection !== undefined ? props.selection : ownSelection;
  const setSelection = props.onSelect ?? setOwnSelection;

  const bounds: TimeWindow = { from: 0, to: duration };
  const rows = useMemo(() => buildLanes(tracks, expanded), [tracks, expanded]);

  /** Every key time on every row — what a dragged key snaps to. */
  const snapTimes = useMemo(() => {
    const out = new Set<number>([0, duration]);
    for (const row of rows) {
      if (row.kind === 'sampled') for (const k of (row.track as SampledTrack<unknown>).keys) out.add(k.t + row.offset);
    }
    return [...out];
  }, [rows, duration]);

  const toggle = (key: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const onRootKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
      e.preventDefault();
      const r = deleteKey(tracks, selection);
      onChange(r.tracks);
      setSelection(r.selection);
    }
  };

  const selectedTrack = selection ? tracks[selection.trackIndex] : undefined;
  const selectedKey = selectedTrack?.kind === 'sampled'
    ? (selectedTrack as SampledTrack<unknown>).keys[selection!.keyIndex]
    : undefined;

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      data-testid="timeline-root"
      tabIndex={-1}
      onKeyDown={onRootKeyDown}
    >
      {label ? <div className={s.label}>{label}</div> : null}

      {props.transport === false ? null : (
        <Transport
          {...(props.transport ?? {
            paused: true, loop: false, rate: 1,
            onPlay: () => {}, onPause: () => {},
            onLoopChange: () => {}, onRateChange: () => {},
          })}
          playhead={playhead}
          duration={duration}
        />
      )}

      <div className={s.body}>
        <div className={s.gutter} />
        <div className={s.rulerWrap}>
          <Ruler
            window={win}
            bounds={bounds}
            playhead={playhead}
            onScrub={onScrub}
            onWindowChange={setWindow}
          />
        </div>
      </div>

      <div className={s.lanes}>
        {rows.map((row) => {
          const ti = topLevelIndex(row);
          return (
            <Lane
              key={row.key}
              row={row}
              window={win}
              mode={props.mode ?? 'dope'}
              selection={selection && selection.trackIndex === ti ? selection.keyIndex : null}
              expanded={expanded.has(row.key)}
              snapTimes={snapTimes}
              onToggleExpand={() => toggle(row.key)}
              onSelect={(keyIndex) => { if (ti >= 0) setSelection({ trackIndex: ti, keyIndex }); }}
              onKeyInput={(keyIndex, toMs) => {
                if (ti < 0 || !onInput) return;
                onInput(moveKey(tracks, { trackIndex: ti, keyIndex }, toMs).tracks);
              }}
              onKeyCommit={(keyIndex, toMs) => {
                if (ti < 0) return;
                const r = moveKey(tracks, { trackIndex: ti, keyIndex }, toMs);
                onChange(r.tracks);
                setSelection(r.selection);
              }}
              onInsert={(atMs) => {
                if (ti < 0) return;
                const r = insertKey(tracks, ti, atMs);
                onChange(r.tracks);
                setSelection(r.selection);
              }}
            />
          );
        })}
      </div>

      {renderKeyEditor && selection && selectedKey && selectedTrack?.kind === 'sampled' ? (
        <div className={s.inspector}>
          {renderKeyEditor({
            key: selectedKey,
            track: selectedTrack as SampledTrack<unknown>,
            selection,
            commit: (next) => onChange(setKeyValue(tracks, selection, next.value)),
            setEasing: (easing) => onChange(setKeyEasing(tracks, selection, easing)),
          })}
        </div>
      ) : null}
    </div>
  );
}
```

Append to `Timeline.module.css`. **`.root` sets an explicit `display: flex; flex-direction: column`
and `.lanes` gets `min-height: 0`** — a `flex: 1` child inside a block container resolves to
nothing and renders an empty panel with every test still green, which is exactly how the labkit
workspace collapsed:

```css
.root {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--wzl-surface-1);
  border: 1px solid var(--wzl-border);
  border-radius: 4px;
  color: var(--wzl-text);
}

.label { padding: 4px 6px; font-size: var(--wzl-font-xs, 10px); color: var(--wzl-text-muted); }

.body { display: flex; align-items: stretch; }
.gutter { flex: 0 0 var(--wzl-timeline-label-w, 120px); border-right: 1px solid var(--wzl-border); }
.rulerWrap { flex: 1 1 auto; min-width: 0; }

.lanes {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.inspector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-top: 1px solid var(--wzl-border);
  background: var(--wzl-surface-2);
  font-size: var(--wzl-font-xs, 10px);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Timeline.test.tsx`

Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline
git commit -m "assemble the pure Timeline editor"
```

---

## Task 14: Graph mode

**Files:**
- Modify: `packages/ui/src/components/Timeline/Lane.tsx`
- Modify: `packages/ui/src/components/Timeline/Lane.test.tsx`
- Modify: `packages/ui/src/components/Timeline/Timeline.tsx` (mode toggle)
- Modify: `packages/ui/src/components/Timeline/Timeline.module.css`

- [ ] **Step 1: Write the failing test**

Append to `Lane.test.tsx`:

```tsx
describe('Lane in graph mode', () => {
  it('draws a curve for a numeric sampled track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    expect(screen.getByTestId('timeline-curve')).toBeInTheDocument();
  });

  it('positions a key by value as well as time', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} />);
    const [first, second] = screen.getAllByTestId('timeline-key');
    expect(first).toHaveStyle({ bottom: '0%' });
    expect(second).toHaveStyle({ bottom: '100%' });
  });

  it('drags a key in value as well as time', () => {
    const onKeyCommit = vi.fn();
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} onKeyCommit={onKeyCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 0, button: 0 });
    fireEvent.pointerMove(document, { clientX: 250, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 250, clientY: 10 });
    expect(onKeyCommit).toHaveBeenCalledWith(1, 500, expect.closeTo(5, 1));
  });

  it('stays a dope row for a non-numeric sampled track', () => {
    const posed = {
      kind: 'sampled', label: 'p',
      keys: [{ t: 0, value: { x: 0 } }, { t: 500, value: { x: 1 } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(posed)} />);
    expect(screen.queryByTestId('timeline-curve')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('stays a dope row for an event track', () => {
    render(<Lane {...base} mode="graph" row={laneOf(eventTrack)} />);
    expect(screen.queryByTestId('timeline-curve')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-event')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/Lane.test.tsx`

Expected: FAIL — `timeline-curve` not found; `onKeyCommit` called with two arguments, not three.

- [ ] **Step 3: Write minimal implementation**

Widen `LaneProps` so both callbacks carry an optional value, present only in graph mode on a
numeric row:

```ts
  onKeyInput: (keyIndex: number, toMs: number, value?: number) => void;
  onKeyCommit: (keyIndex: number, toMs: number, value?: number) => void;
```

In `Lane.tsx`, compute the value axis from the row's own keys and draw the curve with an inline SVG
polyline sampled through `sampleEasing`, so a segment's easing is visible in its shape:

```tsx
import { sampleEasing } from './easingSpec';

/** Samples per segment when drawing an eased curve. */
const CURVE_SAMPLES = 16;

const graph = props.mode === 'graph' && row.numeric;
const keys = row.kind === 'sampled' ? (row.track as SampledTrack<number>).keys : [];
const values = keys.map((k) => k.value);
const lo = graph ? Math.min(...values) : 0;
const hi = graph ? Math.max(...values) : 1;
const vSpan = hi - lo || 1;
const vPct = (v: number): string => `${((v - lo) / vSpan) * 100}%`;

const valueAt = (clientY: number): number => {
  const rect = trackRef.current?.getBoundingClientRect();
  if (!rect || rect.height === 0) return lo;
  const frac = 1 - (clientY - rect.top) / rect.height;
  return lo + frac * vSpan;
};

const curvePoints = (): string => {
  const pts: string[] = [];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    const eased = sampleEasing(b.easing, CURVE_SAMPLES);
    for (let j = 0; j < eased.length; j++) {
      const t = a.t + ((b.t - a.t) * j) / (eased.length - 1);
      const v = a.value + (b.value - a.value) * eased[j];
      pts.push(`${((t + row.offset - win.from) / span) * 100},${100 - ((v - lo) / vSpan) * 100}`);
    }
  }
  return pts.join(' ');
};
```

Render the curve above the keys when `graph` is true, and give each key a `bottom: vPct(value)` in
addition to its `left`:

```tsx
{graph && keys.length > 1 ? (
  <svg className={s.curve} data-testid="timeline-curve" viewBox="0 0 100 100" preserveAspectRatio="none">
    <polyline points={curvePoints()} vectorEffect="non-scaling-stroke" />
  </svg>
) : null}
```

The drag handler passes the value through only when `graph` is set:

```tsx
const move = (ev: PointerEvent): void => {
  onKeyInput(i, at(ev), graph ? valueAt(ev.clientY) : undefined);
};
const up = (ev: PointerEvent): void => {
  onKeyCommit(i, at(ev), graph ? valueAt(ev.clientY) : undefined);
  end();
};
```

In `Timeline.tsx`, route the third argument and add the mode toggle to the transport row:

```tsx
onKeyCommit={(keyIndex, toMs, value) => {
  if (ti < 0) return;
  const r = moveKey(tracks, { trackIndex: ti, keyIndex }, toMs);
  onChange(value === undefined ? r.tracks : setKeyValue(r.tracks, r.selection!, value));
  setSelection(r.selection);
}}
```

```css
.curve {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  fill: none;
  stroke: var(--wzl-accent);
  stroke-width: 1;
}

.lane[data-mode='graph'] { min-height: 72px; }
.lane[data-mode='graph'] .key { top: auto; transform: translateY(50%) rotate(45deg); }
```

Set `data-mode` on the lane element from `props.mode` so the height and key positioning switch with
it, and add `mode` to `Lane`'s destructuring.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline`

Expected: PASS — every file in the directory.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline
git commit -m "give a numeric lane a value axis in graph mode"
```

---

## Task 15: Segment selection and the easing picker

**Files:**
- Create: `packages/ui/src/components/Timeline/EasingPicker.tsx`
- Create: `packages/ui/src/components/Timeline/EasingPicker.test.tsx`
- Modify: `packages/ui/src/components/Timeline/Lane.tsx` (segment hit target, bezier handles)
- Modify: `packages/ui/src/components/Timeline/Timeline.tsx` (segment selection, inspector)
- Modify: `packages/ui/src/components/Timeline/Timeline.module.css`

Two rows of the spec's interaction table land here: *click a segment → select it, easing picker in
the inspector strip*, and *drag a bezier handle (graph mode) → write `{ bezier: [...] }` onto the
key*. Everything underneath already exists — `setKeyEasing` in `keys.ts`, `EASING_NAMES`,
`easingBezier` and `sampleEasing` in `easingSpec.ts`, and `KeyEditorCtx.setEasing`.

A segment is identified by the key it runs *into*, because that is the key whose `easing` shapes it
— the same convention `sampleTrack` uses at line 45. So a segment selection is just a
`KeySelection`, and no new type is needed.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Timeline/EasingPicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { EasingPicker } from './EasingPicker';

describe('EasingPicker', () => {
  it('shows linear when there is no easing', () => {
    render(<EasingPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('linear');
  });

  it('shows the name of a named easing', () => {
    render(<EasingPicker value="easeOutBack" onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('easeOutBack');
  });

  it('offers every built-in name', () => {
    render(<EasingPicker value={undefined} onChange={() => {}} />);
    expect(screen.getByRole('option', { name: 'easeInOutCubic' })).toBeInTheDocument();
  });

  it('writes a name when one is chosen', () => {
    const onChange = vi.fn();
    render(<EasingPicker value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/easing/i), { target: { value: 'easeOutBack' } });
    expect(onChange).toHaveBeenCalledWith('easeOutBack');
  });

  it('clears the easing when linear is chosen', () => {
    const onChange = vi.fn();
    render(<EasingPicker value="easeOutBack" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText(/easing/i), { target: { value: 'linear' } });
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows a bezier spec as a custom entry rather than a name', () => {
    render(<EasingPicker value={{ bezier: [0.4, 0, 0.2, 1] }} onChange={() => {}} />);
    expect(screen.getByLabelText(/easing/i)).toHaveValue('custom');
    expect(screen.getByText('cubic-bezier(0.4, 0, 0.2, 1)')).toBeInTheDocument();
  });

  it('converts a named easing to control points on request', () => {
    const onChange = vi.fn();
    render(<EasingPicker value="easeInOutCubic" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /convert to bezier/i }));
    expect(onChange).toHaveBeenCalledWith({ bezier: [0.65, 0, 0.35, 1] });
  });

  it('draws the curve it is showing', () => {
    render(<EasingPicker value="easeInQuad" onChange={() => {}} />);
    const pts = screen.getByTestId('easing-preview').querySelector('polyline')!.getAttribute('points')!;
    expect(pts.split(' ').length).toBeGreaterThan(4);
  });
});
```

Append to `Lane.test.tsx`:

```tsx
describe('Lane segment selection', () => {
  it('selects the segment running into a key', () => {
    const onSelectSegment = vi.fn();
    render(<Lane {...base} row={laneOf(sampled)} onSelectSegment={onSelectSegment} />);
    fireEvent.click(screen.getAllByTestId('timeline-segment')[0]);
    expect(onSelectSegment).toHaveBeenCalledWith(1);
  });

  it('renders one segment per gap between keys', () => {
    render(<Lane {...base} row={laneOf(sampled)} />);
    expect(screen.getAllByTestId('timeline-segment')).toHaveLength(1);
  });

  it('renders no segments on an event row', () => {
    render(<Lane {...base} row={laneOf(eventTrack)} />);
    expect(screen.queryAllByTestId('timeline-segment')).toHaveLength(0);
  });

  it('drags a bezier handle in graph mode', () => {
    const onEasingCommit = vi.fn();
    const eased = {
      kind: 'sampled', label: 'x',
      keys: [{ t: 0, value: 0 }, { t: 500, value: 10, easing: { bezier: [0.4, 0, 0.2, 1] } }],
      onTick: () => {},
    } as unknown as Track;
    render(<Lane {...base} mode="graph" row={laneOf(eased)} selectedSegment={1} onEasingCommit={onEasingCommit} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-bezier-handle')[0], { clientX: 100, clientY: 10, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 10 });
    fireEvent.pointerUp(document, { clientX: 150, clientY: 10 });
    expect(onEasingCommit).toHaveBeenCalledTimes(1);
    expect(onEasingCommit.mock.calls[0][1]).toHaveProperty('bezier');
  });

  it('shows no bezier handles for a spec without control points', () => {
    render(<Lane {...base} mode="graph" row={laneOf(sampled)} selectedSegment={1} />);
    expect(screen.queryAllByTestId('timeline-bezier-handle')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/EasingPicker.test.tsx packages/ui/src/components/Timeline/Lane.test.tsx`

Expected: FAIL — `Failed to resolve import "./EasingPicker"`, and `timeline-segment` not found.

- [ ] **Step 3: Write minimal implementation**

`packages/ui/src/components/Timeline/EasingPicker.tsx`:

```tsx
import type { ReactElement } from 'react';
import type { EasingSpec } from '@weasel-js/core';
import s from './Timeline.module.css';
import { EASING_NAMES, easingBezier, easingLabel, sampleEasing } from './easingSpec';

/** Samples drawn in the inline curve preview. */
const PREVIEW_SAMPLES = 24;

/** Control points for the named curves the picker can convert. A name the table
 *  does not cover converts to the CSS default rather than refusing. */
const BEZIER_OF: Partial<Record<string, [number, number, number, number]>> = {
  linear: [0, 0, 1, 1],
  easeInQuad: [0.11, 0, 0.5, 0],
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInSine: [0.12, 0, 0.39, 0],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
};

const DEFAULT_BEZIER: [number, number, number, number] = [0.25, 0.1, 0.25, 1];

export interface EasingPickerProps {
  value: EasingSpec | undefined;
  onChange: (next: EasingSpec | undefined) => void;
}

export function EasingPicker(props: EasingPickerProps): ReactElement {
  const { value, onChange } = props;
  const bezier = easingBezier(value);
  const label = easingLabel(value);
  const named = bezier === null && EASING_NAMES.includes(label as never);
  const selectValue = bezier !== null ? 'custom' : named ? label : 'linear';

  const points = sampleEasing(value, PREVIEW_SAMPLES)
    .map((v, i) => `${(i / (PREVIEW_SAMPLES - 1)) * 100},${100 - v * 100}`)
    .join(' ');

  return (
    <div className={s.easingPicker}>
      <label>
        Easing
        <select
          value={selectValue}
          onChange={(e) => onChange(e.target.value === 'linear' ? undefined : e.target.value as EasingSpec)}
        >
          <option value="linear">linear</option>
          {EASING_NAMES.filter((n) => n !== 'linear').map((n) => <option key={n} value={n}>{n}</option>)}
          {bezier !== null ? <option value="custom">custom</option> : null}
        </select>
      </label>

      {bezier !== null ? <span className={s.easingLabel}>{label}</span> : (
        <button
          type="button"
          className={s.transportButton}
          onClick={() => onChange({ bezier: BEZIER_OF[selectValue] ?? DEFAULT_BEZIER })}
        >
          Convert to bezier
        </button>
      )}

      <svg className={s.easingPreview} data-testid="easing-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
```

The `<select>` is right here for the same reason it was right in `Transport`: it carries role, name
and keyboard operability natively.

In `Lane.tsx`, add three props and render a segment strip between consecutive keys:

```ts
  /** Index of the key a selected segment runs INTO, or null. */
  selectedSegment?: number | null;
  onSelectSegment?: (keyIndex: number) => void;
  onEasingCommit?: (keyIndex: number, easing: EasingSpec) => void;
```

```tsx
{row.kind === 'sampled' ? keys.slice(1).map((k, i) => (
  <div
    key={`seg-${i}`}
    role="button"
    tabIndex={0}
    aria-label={`${row.label} segment into ${Math.round(k.t)} ms`}
    aria-current={selectedSegment === i + 1 ? 'true' : undefined}
    data-testid="timeline-segment"
    className={s.segment}
    style={{ left: pct(keys[i].t), width: `${span === 0 ? 0 : ((k.t - keys[i].t) / span) * 100}%` }}
    onClick={() => onSelectSegment?.(i + 1)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment?.(i + 1); } }}
  />
)) : null}
```

The bezier handles render only when `graph && selectedSegment !== null` and
`easingBezier(keys[selectedSegment].easing)` is non-null. Each handle drags on the same
document-listener idiom as a key, converting its px offset back into the 0..1 control-point space
of its segment, and calls `onEasingCommit(selectedSegment, { bezier: nextPoints })` once on
pointerup. **No `setPointerCapture`** — the proxy assertion in this file covers the handles too
once they exist.

In `Timeline.tsx`, hold `selectedSegment` in the same state as `selection` (a `KeySelection | null`
in its own `useState`), pass `onSelectSegment` down, and render `<EasingPicker>` in the inspector
strip when a segment is selected, wiring its `onChange` to
`onChange(setKeyEasing(tracks, segmentSelection, next))`.

Append to `Timeline.module.css`:

```css
.segment {
  position: absolute;
  top: 0;
  bottom: 0;
  cursor: pointer;
}

.segment[aria-current='true'] { background: var(--wzl-accent-soft); }
.segment:focus-visible { outline: 2px solid var(--wzl-focus); outline-offset: -2px; }

.easingPicker { display: inline-flex; align-items: center; gap: 6px; }
.easingLabel { font-variant-numeric: tabular-nums; color: var(--wzl-text-muted); }

.easingPreview {
  width: 32px;
  height: 32px;
  fill: none;
  stroke: var(--wzl-accent);
  stroke-width: 1;
  border: 1px solid var(--wzl-border);
}

.bezierHandle {
  position: absolute;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: var(--wzl-surface-1);
  border: 1px solid var(--wzl-accent);
  cursor: grab;
}
```

A segment strip sits *under* the keys in paint order, so put it before the key list in the JSX —
otherwise it swallows every key's pointerdown and nothing drags.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline`

Expected: PASS — every file in the directory, 8 new picker tests and 5 new lane tests among them.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline
git commit -m "select a segment and edit the easing it runs on"
```

---

## Task 16: `AnimatedTimeline.tsx`

**Files:**
- Create: `packages/ui/src/components/Timeline/AnimatedTimeline.tsx`
- Create: `packages/ui/src/components/Timeline/AnimatedTimeline.test.tsx`

The fact this task turns on: `createTimeline.ts:198` is `tracks: () => opts.tracks` — the **live**
array. Splicing it inside `edit()` is what propagates. Building a replacement array and assigning
it does nothing and reports nothing.

The second: `rearm` returns early on `playhead >= duration`, so `resume()` alone never restarts a
finished timeline. Play seeks to 0 first when the playhead is at the end.

- [ ] **Step 1: Write the failing test**

```tsx
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import type { SampledTrack, TimelineHandle, Track } from '@weasel-js/core';
import { AnimatedTimeline } from './AnimatedTimeline';

const TRACK_WIDTH = 500;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0, y: 0, top: 0, left: 0, right: TRACK_WIDTH, bottom: 20,
      width: TRACK_WIDTH, height: 20, toJSON: () => {},
    } as DOMRect;
  };
});

/** A stand-in with the live-array semantics `createTimeline` actually has:
 *  `tracks()` returns the same array object every call, and `edit` runs the
 *  mutation against it. A fake returning a copy would make the splice below a
 *  no-op and the test would still pass, which is the bug this guards. */
function fakeHandle(over: Partial<TimelineHandle> = {}): TimelineHandle & { live: Track[] } {
  const live: Track[] = [
    { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 500, value: 10 }], onTick: () => {} } as Track,
  ];
  let t = 0;
  let paused = true;
  return {
    live,
    id: 1,
    cancel: vi.fn(), pause: vi.fn(() => { paused = true; }), resume: vi.fn(() => { paused = false; }),
    setTimeScale: vi.fn(), isPaused: () => paused,
    seek: vi.fn((to: number) => { t = to; }),
    time: () => t,
    duration: () => 1000,
    tracks: () => live,
    edit: vi.fn((fn: () => void) => { fn(); }),
    subscribe: () => () => {},
    setLoop: vi.fn(),
    ...over,
  } as TimelineHandle & { live: Track[] };
}

describe('AnimatedTimeline', () => {
  it('renders the handle’s tracks', () => {
    render(<AnimatedTimeline handle={fakeHandle()} />);
    expect(screen.getAllByTestId('timeline-key')).toHaveLength(2);
  });

  it('routes an edit through edit(), mutating the live array in place', () => {
    const h = fakeHandle();
    const before = h.tracks();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getAllByTestId('timeline-key')[1], { clientX: 250, clientY: 10, button: 0 });
    fireEvent.pointerUp(document, { clientX: 400, clientY: 10 });
    expect(h.edit).toHaveBeenCalledTimes(1);
    expect(h.tracks()).toBe(before);
    expect((h.tracks()[0] as SampledTrack<number>).keys[1].t).toBe(800);
  });

  it('scrubs through seek', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.pointerDown(screen.getByTestId('timeline-ruler'), { clientX: 250, clientY: 5, button: 0 });
    expect(h.seek).toHaveBeenCalledWith(500);
  });

  it('resumes on play', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('rewinds before resuming a timeline parked at its duration', () => {
    const h = fakeHandle({ time: () => 1000 });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).toHaveBeenCalledWith(0);
    expect(h.resume).toHaveBeenCalledTimes(1);
  });

  it('does not rewind a timeline mid-run', () => {
    const h = fakeHandle({ time: () => 400 });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /play/i }));
    expect(h.seek).not.toHaveBeenCalled();
  });

  it('pauses on pause', () => {
    const h = fakeHandle({ isPaused: () => false });
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: /pause/i }));
    expect(h.pause).toHaveBeenCalledTimes(1);
  });

  it('routes the loop toggle to setLoop', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.click(screen.getByRole('switch', { name: /loop/i }));
    expect(h.setLoop).toHaveBeenCalledWith(true);
  });

  it('routes the rate control to setTimeScale', () => {
    const h = fakeHandle();
    render(<AnimatedTimeline handle={h} />);
    fireEvent.change(screen.getByLabelText(/rate/i), { target: { value: '2' } });
    expect(h.setTimeScale).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/AnimatedTimeline.test.tsx`

Expected: FAIL — `Failed to resolve import "./AnimatedTimeline"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useCallback, useEffect, useReducer, useRef, useState, type ReactElement } from 'react';
import { useVisibleRaf, type TimelineHandle, type Track } from '@weasel-js/core';
import { Timeline, type TimelineProps } from './Timeline';

export interface AnimatedTimelineProps
  extends Omit<TimelineProps, 'tracks' | 'duration' | 'playhead' | 'onChange' | 'onScrub' | 'transport'> {
  handle: TimelineHandle;
  /** `false` hides the transport, as on `<Timeline>`. */
  transport?: false;
}

/** Binds `<Timeline>` to a live handle.
 *
 *  `handle.tracks()` returns the timeline's own array, not a copy, so an edit
 *  splices it in place inside `edit()`. Assigning a replacement array would
 *  update nothing and raise nothing. */
export function AnimatedTimeline(props: AnimatedTimelineProps): ReactElement {
  const { handle, ...rest } = props;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [loop, setLoopState] = useState<boolean | number>(false);
  const [rate, setRate] = useState(1);

  // `subscribe` fires on `edit` only, so the playhead comes from the frame loop.
  useEffect(() => handle.subscribe(bump), [handle]);

  // `useVisibleRaf` returns a controller; a continuous loop re-requests from
  // inside its own frame, and nothing runs until something calls `request`.
  // No `onResume` here: this loop measures no elapsed time of its own, it only
  // reads the playhead the animator already advanced.
  const rafRef = useRef<{ request(): void } | null>(null);
  const raf = useVisibleRaf(() => {
    bump();
    if (!handle.isPaused()) rafRef.current?.request();
  });
  rafRef.current = raf;
  useEffect(() => {
    if (!handle.isPaused()) raf.request();
    return () => raf.cancel();
  }, [handle, raf]);

  const onChange = useCallback((next: Track[]) => {
    handle.edit(() => {
      const live = handle.tracks() as Track[];
      live.splice(0, live.length, ...next);
    });
  }, [handle]);

  const playhead = handle.time();
  const duration = handle.duration();

  return (
    <Timeline
      {...rest}
      tracks={handle.tracks()}
      duration={duration}
      playhead={playhead}
      onChange={onChange}
      onScrub={handle.seek}
      transport={props.transport === false ? false : {
        paused: handle.isPaused(),
        loop,
        rate,
        onPlay: () => {
          // `rearm` declines to revive a timeline at its duration, so resume
          // alone would do nothing. Play-at-end rewinds first.
          if (handle.time() >= duration) handle.seek(0);
          handle.resume();
          raf.request();
          bump();
        },
        onPause: () => { handle.pause(); bump(); },
        onLoopChange: (next) => { handle.setLoop(next); setLoopState(next); },
        onRateChange: (next) => { handle.setTimeScale(next); setRate(next); },
      }}
    />
  );
}
```

`loop` and `rate` are held here because `TimelineHandle` exposes no getter for either. That is a
real gap; note it in the TODO rather than reading them back through a cast.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Timeline/AnimatedTimeline.test.tsx`

Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Timeline/AnimatedTimeline.tsx packages/ui/src/components/Timeline/AnimatedTimeline.test.tsx
git commit -m "bind the Timeline editor to a live timeline handle"
```

---

## Task 17: Export, story, and the visual check

**Files:**
- Create: `packages/ui/src/components/Timeline/index.ts`
- Create: `packages/ui/src/components/Timeline/Timeline.stories.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the barrel**

`packages/ui/src/components/Timeline/index.ts`:

```ts
export { Timeline } from './Timeline';
export type { KeyEditorCtx, KeySelection, TimelineProps, TimeWindow } from './Timeline';
export { AnimatedTimeline } from './AnimatedTimeline';
export type { AnimatedTimelineProps } from './AnimatedTimeline';
export { Transport } from './Transport';
export type { TransportProps } from './Transport';
export { EasingPicker } from './EasingPicker';
export type { EasingPickerProps } from './EasingPicker';
export { EASING_NAMES, easingBezier, easingLabel, sampleEasing } from './easingSpec';
```

In `packages/ui/src/index.ts`, add beside the other component stars (near line 54):

```ts
export * from './components/Timeline';
```

- [ ] **Step 2: Write the story**

`packages/ui/src/components/Timeline/Timeline.stories.tsx`. Read `BandEditor.stories.tsx` first and
copy its `meta` block's shape — title path, `parameters`, `tags` — rather than inventing one.

```tsx
import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { Track } from '@weasel-js/core';
import { Timeline } from './Timeline';

const meta: Meta<typeof Timeline> = {
  title: 'Components/Timeline',
  component: Timeline,
};
export default meta;

function Harness({ initial, mode }: { initial: Track[]; mode?: 'dope' | 'graph' }): ReactElement {
  const [tracks, setTracks] = useState(initial);
  const [playhead, setPlayhead] = useState(0);
  return (
    <div style={{ height: 240, width: 640 }}>
      <Timeline
        tracks={tracks}
        duration={2000}
        playhead={playhead}
        mode={mode}
        onChange={setTracks}
        onScrub={setPlayhead}
        renderKeyEditor={({ key }) => <span>value: {String(key.value)}</span>}
      />
    </div>
  );
}

const flat = (): Track[] => ([
  { kind: 'sampled', label: 'x', keys: [{ t: 0, value: 0 }, { t: 800, value: 120, easing: 'easeOutCubic' }, { t: 1600, value: 40 }], onTick: () => {} },
  { kind: 'sampled', label: 'opacity', keys: [{ t: 0, value: 0 }, { t: 400, value: 1 }], onTick: () => {} },
  { kind: 'event', label: 'footstep', events: [{ t: 300, fire: () => {} }, { t: 900, fire: () => {} }, { t: 1500, fire: () => {} }] },
] as Track[]);

const withNested = (): Track[] => ([
  ...flat(),
  {
    kind: 'timeline', label: 'blink', at: 600,
    timeline: { tracks: [{ kind: 'sampled', label: 'lid', keys: [{ t: 0, value: 1 }, { t: 200, value: 0 }], onTick: () => {} }], duration: 400 },
  },
] as Track[]);

export const Dope: StoryObj = { render: () => <Harness initial={flat()} /> };
export const Graph: StoryObj = { render: () => <Harness initial={flat()} mode="graph" /> };
export const Nested: StoryObj = { render: () => <Harness initial={withNested()} /> };
```

The wrapper's fixed `height` is deliberate and is the reason the story can show a collapse: the
component is a flex column with a scrolling `.lanes`, and in a container with no height it renders
as a strip. If `Dope` shows lanes and the same markup in a real panel does not, the panel's
container is the bug, not the component.

The height and width here are the one legitimate use of an inline `style` in this repo — a story
harness sizing its own viewport, not component styling.

Storybook's `&globals=theme:dark` sets `data-theme`, which nothing in `tokens.css` reads —
`applyTheme` writes `data-wzl-mode`. A bare `@weasel-js/ui` story therefore renders on the `:root`
dark default in both modes, so a URL-driven "both themes" check verifies one theme twice. Add a
decorator that sets `data-wzl-mode` on a wrapping element to see light.

- [ ] **Step 3: Run the full suites and typecheck**

Run: `npx vitest run --project=weasel-ui`

Expected: PASS.

Run: `npx vitest run --project=kit`

Expected: PASS.

Run: `npx tsc --noEmit`

Expected: exit 0.

Run: `npx eslint packages/ui/src/components/Timeline packages/core/src/animation`

Expected: exit 0.

- [ ] **Step 4: Screenshot it — do not skip this**

A green suite does not show that the component rendered. `.lanes` is a `flex: 1` child inside a
scrolling column; if `.root`'s `display: flex` is ever lost the panel collapses to nothing with
every test still passing. Run Storybook, open the `Dope` story, and look at it:

```bash
npm run storybook
```

Confirm four things by eye, in both `data-wzl-mode="light"` and `"dark"`:
1. Lanes have height and the keys sit on them.
2. The transport's glyph buttons are not crushed — `theme/base.less` sets `height: var(--wzl-control-h)` on bare `button` inside `:where()`, which has bitten 16px glyphs before.
3. The ruler's ticks line up with the keys at the times they claim.
4. The playhead tracks the scrub.

Then `open` the screenshot so it lands on screen rather than only in the transcript.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src
git commit -m "export the Timeline editor and add its stories"
```

---

## Task 18: Changeset and TODO

**Files:**
- Create: `.changeset/timeline-editor.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Write the changeset**

**`patch`.** Every changeset in this repo is `patch`; `minor`/`major` need Mike's explicit OK in
conversation and a `bump-approved` marker, and writing that marker yourself defeats the mechanism.

```markdown
---
'@weasel-js/ui': patch
---

Add `<Timeline>`, a keyframe editor for the timeline primitive.

`<Timeline>` is controlled and pure: it takes tracks, a duration and a playhead,
and emits `onInput` during a gesture and `onChange` at its end.
`<AnimatedTimeline handle={h}>` binds it to a live `TimelineHandle`.

A dope sheet edits time and easing for every track kind. A graph mode adds a
value axis, and only for sampled tracks whose values are numbers — a `Pose` has
no honest vertical position, so those rows stay dope rows. `renderKeyEditor`
hands the selected key to the consumer, which supplies a control that knows its
own value type.
```

- [ ] **Step 2: Retire the TODO entry**

Delete the `(P2) <Timeline> editor` entry under **Animation → Timelines and rigging** in
`docs/TODO.md`, and its line under **Next up** in the High-priority index. Both, or neither — the
index is a hand-maintained copy.

- [ ] **Step 3: File the two gaps this arc found**

Add under **Animation → Timelines and rigging**:

```markdown
- **(P3) `TimelineHandle` has no getter for `loop` or the time scale.** `setLoop`
  and `setTimeScale` write; nothing reads back. `AnimatedTimeline` therefore
  mirrors both in React state, which drifts the moment anything else on the
  handle sets them. Two getters on the handle would remove the mirror.
- **(P3) Nested tracks are read-only in `<Timeline>`.** A nested timeline's lane
  expands and its keys draw at the right times, but `keys.ts` addresses a track
  by a single top-level index, so a nested key does not drag. Widening
  `KeySelection` to the `LaneRow` path is the change.
```

- [ ] **Step 4: Verify**

Run: `npm run check:bumps`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add .changeset/timeline-editor.md docs/TODO.md
git commit -m "record the Timeline editor and the two gaps it surfaced"
```

---

## Done when

- `npx vitest run --project=kit` and `--project=weasel-ui` both pass.
- `npx tsc --noEmit` from the repo root exits 0.
- `npm run check:bumps` exits 0.
- The `Dope` story has been looked at in both modes and the four checks in Task 17 Step 4 hold.
