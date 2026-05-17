# Animation primitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `src/animation/` module — a per-Canvas rAF-driven animator (`tween` / `spring` / `decay`), pose-aware helpers (`tweenPose` / `springPose`), three adapter wrappers (`animateOnSetPose`, `animateLifecycle`), and a `momentum` `MoveBehavior`, all composable with the existing scene/move stack.

**Architecture:** The animator owns one rAF loop per Canvas, ticking active animations and writing through `adapter.setPose` directly (bypassing op generation). One transform op fires at animation start so undo/history stay clean. Wrappers compose by intercepting `setPose` / `insertNode` / `removeNode` on a base adapter. The `momentum` behavior plugs into `useMove`'s existing behavior pipeline and triggers a `decay` on release.

**Tech Stack:** TypeScript + React (animator is a hook), Vitest with `now`-injection for deterministic frame ticks. No new runtime deps.

**Spec:** `docs/specs/2026-05-04-animation-primitive-design.md` is authoritative. When this plan and the spec disagree, the spec wins.

---

## File Structure

**Create:**

- `src/animation/types.ts` — `Animator`, `AnimationHandle`, `EasingFn`, `Interpolate<T>`, `TweenOptions<T>`, `SpringOptions<T>`, `DecayOptions<T>`, `SpringPreset`, `UseAnimatorOptions`. Types only.
- `src/animation/easings.ts` — `linear`, `easeIn`, `easeOut`, `easeInOut`, `SPRING_PRESETS`.
- `src/animation/easings.test.ts`.
- `src/animation/useAnimator.ts` — the hook. Owns the rAF loop, the `Map<number, ActiveAnimation>` registry, the per-frame tick, cancel APIs.
- `src/animation/useAnimator.test.tsx`.
- `src/animation/poseHelpers.ts` — `tweenPose`, `springPose`. Default rect-pose lerp lives here.
- `src/animation/poseHelpers.test.ts`.
- `src/animation/wrappers/animateOnSetPose.ts`.
- `src/animation/wrappers/animateOnSetPose.test.ts`.
- `src/animation/wrappers/animateLifecycle.ts`.
- `src/animation/wrappers/animateLifecycle.test.ts`.
- `src/animation/wrappers/index.ts` — barrel.
- `src/animation/behaviors/momentum.ts` — `MoveBehavior` plug-in that records pointer velocity in `ctx.scratch` and fires `animator.decay` on end.
- `src/animation/behaviors/momentum.test.ts`.
- `src/animation/index.ts` — top-level barrel.
- `demo/demos/AnimationDemo.tsx` — three buttons: "Tween to point", "Spring to point", and a draggable card showing the `momentum` flick.
- `demo/demos/__tests__/animationDemo.integration.test.tsx`.

**Modify:**

- `src/interactions/actions/resize/geometry.ts` — extend `PoseDescriptor<TPose>` with optional `lerp?(a, b, t): TPose`. Implement on `RECT_POSE_DESCRIPTOR`.
- `src/features/paths/poseDescriptor.ts` — implement `lerp` on `pathPoseDescriptor` for the `kind === 'rect'` case (linear lerp of x/y/width/height); polygon variant linearly lerps `coords` arrays of equal length and otherwise throws.
- `src/index.ts` — `export * from './animation';`.
- `docs/TODO.md` — remove the "Animation as a primitive concept" entry from Tier 1; append the deferred items from the spec.

**Tests:** Every new module has a unit test. Wrappers use a tiny in-memory dummy adapter (defined inline in the test files) so tests stay isolated from the rest of the kit. The animator uses `now` injection — no `vi.useFakeTimers()` or rAF polyfill needed; we still need to stub `requestAnimationFrame` / `cancelAnimationFrame` to drive the loop deterministically.

---

## Conventions for this plan

- All commits use the project's standard trailer:
  ```
  Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
  ```
- Run the full suite with `npm test -- --run` after every task. Each task ends with that command going green before the commit.
- New file headers mirror peer files: imports, then types, then code. No file-header comments (peers like `src/interactions/gestures/types.ts` and `src/core/adapters/types.ts` have none).
- Op-generation imports: `import { createTransformOp } from '../../core/ops/transform';` from `src/animation/poseHelpers.ts` and `src/animation/wrappers/animateOnSetPose.ts`.
- Adapter-type imports: `import type { SceneAdapter } from '../core/adapters/types';` (or relative depth as needed).

---

### Task 1: Animation core types

**Files:**
- Create: `src/animation/types.ts`

- [ ] **Step 1: Open the spec in the editor**

```bash
open -g docs/specs/2026-05-04-animation-primitive-design.md
```

- [ ] **Step 2: Create `src/animation/types.ts`**

```ts
export type EasingFn = (t: number) => number;

export type Interpolate<T> = (from: T, to: T, t: number) => T;

export interface SpringPreset {
  stiffness: number;
  damping: number;
  mass: number;
}

export type SpringPresetName = 'gentle' | 'wobbly' | 'stiff' | 'slow';

export interface AnimationHandle {
  /** Monotonic id assigned by the animator. */
  id: number;
  /** Cancel this animation. Idempotent — no-op once already finished/canceled. */
  cancel(): void;
}

export interface TweenOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;
  /** Required when T is not `number`. For T = number, defaults to linear numeric lerp. */
  interpolate?: Interpolate<T>;
  onTick: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one in flight. */
  cancelKey?: string;
}

export interface SpringOptions<T> {
  from: T;
  to: T;
  /** Initial velocity in T-units per second. Default: zero (T-shape-aware). */
  velocity?: T;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolate?: Interpolate<T>;
  /** Vector helpers — required for non-numeric T. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  /** Velocity magnitude below which the spring is considered settled. Default 0.01. */
  restThreshold?: number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface DecayOptions<T> {
  from: T;
  velocity: T;
  /** Per-second velocity multiplier in (0, 1). Default 0.95. */
  friction?: number;
  /** Velocity magnitude below which decay stops. Default 0.5. */
  threshold?: number;
  add: (a: T, b: T) => T;
  scale: (v: T, k: number) => T;
  magnitude: (v: T) => number;
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

export interface UseAnimatorOptions {
  /** Optional clock injection for tests. Returns ms since some epoch. */
  now?: () => number;
  /** Optional rAF / cAF injection for tests. Defaults to window.requestAnimationFrame. */
  requestFrame?: (cb: (t: number) => void) => number;
  cancelFrame?: (handle: number) => void;
}

export interface Animator {
  tween<T>(opts: TweenOptions<T>): AnimationHandle;
  spring<T>(opts: SpringOptions<T>): AnimationHandle;
  decay<T>(opts: DecayOptions<T>): AnimationHandle;
  /** Cancel a specific animation by handle. Pose stays at current value (no jump). */
  cancel(handle: AnimationHandle): void;
  /** Cancel every animation currently active under `key`. */
  cancelKey(key: string): void;
  /** Cancel everything. Useful from a destructor or "reset scene" path. */
  cancelAll(): void;
  /** True iff at least one animation is active. With `key`, scoped to that cancelKey. */
  isActive(key?: string): boolean;
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Run full suite**

Run: `npm test -- --run`
Expected: PASS (no behavior change yet — just new types).

- [ ] **Step 5: Commit**

```bash
git add src/animation/types.ts
git commit -m "$(cat <<'EOF'
feat(animation): add core animator types

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Easings + spring presets

**Files:**
- Create: `src/animation/easings.ts`
- Create: `src/animation/easings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/animation/easings.test.ts
import { describe, expect, it } from 'vitest';
import { easeIn, easeInOut, easeOut, linear, SPRING_PRESETS } from './easings';

describe('easings', () => {
  it.each([linear, easeIn, easeOut, easeInOut])('endpoints are 0 and 1 for %o', (fn) => {
    expect(fn(0)).toBeCloseTo(0, 10);
    expect(fn(1)).toBeCloseTo(1, 10);
  });

  it('linear is identity', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(linear(t)).toBeCloseTo(t, 10);
    }
  });

  it('easeIn is convex (slow start)', () => {
    expect(easeIn(0.5)).toBeLessThan(0.5);
  });

  it('easeOut is concave (fast start)', () => {
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('easeInOut is symmetric around 0.5', () => {
    for (const t of [0.1, 0.2, 0.3, 0.4]) {
      expect(easeInOut(t) + easeInOut(1 - t)).toBeCloseTo(1, 10);
    }
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('SPRING_PRESETS', () => {
  it('exposes the four named presets with positive scalars', () => {
    for (const name of ['gentle', 'wobbly', 'stiff', 'slow'] as const) {
      const p = SPRING_PRESETS[name];
      expect(p.stiffness).toBeGreaterThan(0);
      expect(p.damping).toBeGreaterThan(0);
      expect(p.mass).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/easings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/easings.ts`**

```ts
import type { EasingFn, SpringPreset, SpringPresetName } from './types';

export const linear: EasingFn = (t) => t;
export const easeIn: EasingFn = (t) => t * t;
export const easeOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);

export const SPRING_PRESETS: Record<SpringPresetName, SpringPreset> = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff: { stiffness: 210, damping: 20, mass: 1 },
  slow: { stiffness: 80, damping: 20, mass: 1 },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/easings.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/easings.ts src/animation/easings.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): add easings and spring presets

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: useAnimator core — tween

Implement the hook scaffolding plus `tween` only. `spring` and `decay` come in Tasks 4 and 5 to keep diffs reviewable.

**Files:**
- Create: `src/animation/useAnimator.ts`
- Create: `src/animation/useAnimator.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/animation/useAnimator.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { linear } from './easings';

/** Minimal manual rAF driver for deterministic tests. */
function makeClock() {
  let now = 0;
  const callbacks = new Map<number, (t: number) => void>();
  let nextHandle = 1;
  const requestFrame = (cb: (t: number) => void): number => {
    const h = nextHandle++;
    callbacks.set(h, cb);
    return h;
  };
  const cancelFrame = (h: number): void => {
    callbacks.delete(h);
  };
  const advance = (deltaMs: number) => {
    now += deltaMs;
    const due = Array.from(callbacks.entries());
    callbacks.clear();
    for (const [, cb] of due) cb(now);
  };
  return { now: () => now, requestFrame, cancelFrame, advance };
}

describe('useAnimator.tween', () => {
  it('ticks linear values across the duration', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    act(() => {
      result.current.tween<number>({
        from: 0,
        to: 100,
        ms: 1000,
        easing: linear,
        onTick: (v) => ticks.push(v),
      });
    });
    act(() => clock.advance(0));     // first frame at t=0 → value 0
    act(() => clock.advance(500));   // halfway → 50
    act(() => clock.advance(500));   // done → 100
    expect(ticks[0]).toBeCloseTo(0, 6);
    expect(ticks[ticks.length - 1]).toBeCloseTo(100, 6);
    expect(ticks.some((v) => Math.abs(v - 50) < 0.5)).toBe(true);
  });

  it('calls onDone exactly once and isActive returns false after', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, onTick: () => {}, onDone });
    });
    act(() => clock.advance(0));
    expect(result.current.isActive()).toBe(true);
    act(() => clock.advance(100));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.isActive()).toBe(false);
  });

  it('cancel() stops further ticks and skips onDone', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onTick = vi.fn();
    const onDone = vi.fn();
    let handle!: ReturnType<typeof result.current.tween>;
    act(() => {
      handle = result.current.tween({ from: 0, to: 1, ms: 1000, onTick, onDone });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const before = onTick.mock.calls.length;
    act(() => handle.cancel());
    act(() => clock.advance(500));
    expect(onTick.mock.calls.length).toBe(before);
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.isActive()).toBe(false);
  });

  it('cancelKey collisions cancel the prior animation', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const firstDone = vi.fn();
    const secondDone = vi.fn();
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 1000, cancelKey: 'k', onTick: () => {}, onDone: firstDone });
    });
    act(() => clock.advance(0));
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, cancelKey: 'k', onTick: () => {}, onDone: secondDone });
    });
    act(() => clock.advance(100));
    expect(firstDone).not.toHaveBeenCalled();
    expect(secondDone).toHaveBeenCalledTimes(1);
  });

  it('rAF stops when no animations remain (no requestFrame after settle)', () => {
    const clock = makeClock();
    const requestSpy = vi.fn(clock.requestFrame);
    const { result } = renderHook(() =>
      useAnimator({ now: clock.now, requestFrame: requestSpy, cancelFrame: clock.cancelFrame }),
    );
    act(() => {
      result.current.tween({ from: 0, to: 1, ms: 100, onTick: () => {} });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const callsAfterSettle = requestSpy.mock.calls.length;
    act(() => clock.advance(1000));
    expect(requestSpy.mock.calls.length).toBe(callsAfterSettle);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/useAnimator.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/useAnimator.ts`**

```ts
import { useMemo, useRef } from 'react';
import { easeOut } from './easings';
import type {
  AnimationHandle,
  Animator,
  TweenOptions,
  SpringOptions,
  DecayOptions,
  UseAnimatorOptions,
} from './types';

interface ActiveAnimation {
  id: number;
  cancelKey?: string;
  /** Returns true when finished. Called once per frame with the current ms timestamp. */
  tick(now: number): boolean;
  /** Called when the animation is cancelled. Skips onDone. */
  onCancel?(): void;
}

const numericLerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function useAnimator(opts: UseAnimatorOptions = {}): Animator {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const animations = useRef<Map<number, ActiveAnimation>>(new Map());
  const nextId = useRef(1);
  const rafHandle = useRef<number | null>(null);

  return useMemo<Animator>(() => {
    const now = (): number => (optsRef.current.now ?? Date.now)();
    const requestFrame = (cb: (t: number) => void): number =>
      (optsRef.current.requestFrame ?? requestAnimationFrame)(cb);
    const cancelFrame = (h: number): void =>
      (optsRef.current.cancelFrame ?? cancelAnimationFrame)(h);

    const ensureLoop = (): void => {
      if (rafHandle.current != null || animations.current.size === 0) return;
      const tickAll = (t: number): void => {
        rafHandle.current = null;
        const finished: number[] = [];
        for (const anim of animations.current.values()) {
          if (anim.tick(t)) finished.push(anim.id);
        }
        for (const id of finished) animations.current.delete(id);
        if (animations.current.size > 0) {
          rafHandle.current = requestFrame(tickAll);
        }
      };
      rafHandle.current = requestFrame(tickAll);
    };

    const cancelByKey = (key: string): void => {
      const ids: number[] = [];
      for (const anim of animations.current.values()) {
        if (anim.cancelKey === key) ids.push(anim.id);
      }
      for (const id of ids) {
        const anim = animations.current.get(id);
        anim?.onCancel?.();
        animations.current.delete(id);
      }
    };

    const register = (anim: ActiveAnimation): AnimationHandle => {
      if (anim.cancelKey != null) cancelByKey(anim.cancelKey);
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
      };
    };

    const tween = <T,>(o: TweenOptions<T>): AnimationHandle => {
      const id = nextId.current++;
      const start = now();
      const easing = o.easing ?? easeOut;
      const interp =
        o.interpolate ??
        ((a: T, b: T, t: number) => {
          if (typeof a === 'number' && typeof b === 'number') {
            return numericLerp(a as number, b as number, t) as unknown as T;
          }
          throw new Error('tween: interpolate is required for non-numeric T');
        });
      let lastValueEmitted = false;
      return register({
        id,
        cancelKey: o.cancelKey,
        tick(nowMs) {
          const elapsed = nowMs - start;
          const t = o.ms <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / o.ms));
          o.onTick(interp(o.from, o.to, easing(t)));
          if (t >= 1 && !lastValueEmitted) {
            lastValueEmitted = true;
            o.onDone?.();
            return true;
          }
          return false;
        },
      });
    };

    const spring = <T,>(_o: SpringOptions<T>): AnimationHandle => {
      throw new Error('spring: not implemented yet (Task 4)');
    };
    const decay = <T,>(_o: DecayOptions<T>): AnimationHandle => {
      throw new Error('decay: not implemented yet (Task 5)');
    };

    return {
      tween,
      spring,
      decay,
      cancel: (handle) => {
        const a = animations.current.get(handle.id);
        if (!a) return;
        a.onCancel?.();
        animations.current.delete(handle.id);
      },
      cancelKey: cancelByKey,
      cancelAll: () => {
        for (const a of animations.current.values()) a.onCancel?.();
        animations.current.clear();
        if (rafHandle.current != null) {
          cancelFrame(rafHandle.current);
          rafHandle.current = null;
        }
      },
      isActive: (key) => {
        if (key == null) return animations.current.size > 0;
        for (const a of animations.current.values()) {
          if (a.cancelKey === key) return true;
        }
        return false;
      },
    };
  }, []);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/useAnimator.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "$(cat <<'EOF'
feat(animation): useAnimator core with tween primitive

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: useAnimator — spring

Add spring physics on top of the existing animator. Reuse the test harness from Task 3.

**Files:**
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/useAnimator.test.tsx` (append tests)

- [ ] **Step 1: Write the failing test (append to file)**

```tsx
// append to src/animation/useAnimator.test.tsx
import { SPRING_PRESETS } from './easings';

describe('useAnimator.spring', () => {
  it('settles at to within rest threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    const onDone = vi.fn();
    act(() => {
      result.current.spring<number>({
        from: 0,
        to: 100,
        preset: 'stiff',
        onTick: (v) => ticks.push(v),
        onDone,
      });
    });
    // 5s of 16ms frames is more than enough for "stiff" to settle.
    for (let i = 0; i < 320; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(ticks[ticks.length - 1]).toBeCloseTo(100, 1);
  });

  it('honors explicit stiffness/damping/mass over preset', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.spring<number>({
        from: 0,
        to: 1,
        stiffness: 500,
        damping: 30,
        mass: 1,
        onTick: () => {},
        onDone,
      });
    });
    for (let i = 0; i < 200; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('throws if T is non-numeric and vector helpers are missing', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() =>
      result.current.spring({
        from: { x: 0, y: 0 },
        to: { x: 10, y: 10 },
        onTick: () => {},
      } as never),
    ).toThrow(/spring/);
  });
});
```

- [ ] **Step 2: Run test to verify spring tests fail**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t spring`
Expected: FAIL — `spring: not implemented yet (Task 4)`.

- [ ] **Step 3: Replace the `spring` stub in `src/animation/useAnimator.ts`**

Add the helper above `useAnimator` (or just inside the `useMemo`):

```ts
function resolveSpringConstants(o: { preset?: string; stiffness?: number; damping?: number; mass?: number }) {
  const preset = o.preset ? SPRING_PRESETS[o.preset as keyof typeof SPRING_PRESETS] : null;
  return {
    stiffness: o.stiffness ?? preset?.stiffness ?? 170,
    damping: o.damping ?? preset?.damping ?? 26,
    mass: o.mass ?? preset?.mass ?? 1,
  };
}
```

Add the import:

```ts
import { easeOut, SPRING_PRESETS } from './easings';
```

Replace the `spring` body:

```ts
const spring = <T,>(o: SpringOptions<T>): AnimationHandle => {
  const id = nextId.current++;
  const isNumeric = typeof o.from === 'number' && typeof o.to === 'number';
  if (!isNumeric && (!o.add || !o.subtract || !o.scale || !o.magnitude)) {
    throw new Error('spring: add/subtract/scale/magnitude are required for non-numeric T');
  }
  const add = o.add ?? ((a: T, b: T) => ((a as unknown as number) + (b as unknown as number)) as unknown as T);
  const subtract = o.subtract ?? ((a: T, b: T) => ((a as unknown as number) - (b as unknown as number)) as unknown as T);
  const scale = o.scale ?? ((v: T, k: number) => ((v as unknown as number) * k) as unknown as T);
  const magnitude = o.magnitude ?? ((v: T) => Math.abs(v as unknown as number));
  const interp =
    o.interpolate ??
    ((a: T, b: T, t: number) => add(a, scale(subtract(b, a), t)));
  const { stiffness, damping, mass } = resolveSpringConstants(o);
  const restThreshold = o.restThreshold ?? 0.01;

  let value = o.from;
  let velocity: T = (o.velocity ?? scale(subtract(o.to, o.from), 0)) as T;
  let lastTime: number | null = null;

  return register({
    id,
    cancelKey: o.cancelKey,
    tick(nowMs) {
      if (lastTime == null) {
        lastTime = nowMs;
        o.onTick(value);
        return false;
      }
      const dt = Math.min(0.064, (nowMs - lastTime) / 1000); // clamp big jumps
      lastTime = nowMs;
      // Semi-implicit Euler integration of: a = (-k(x - to) - c*v) / m
      const displacement = subtract(value, o.to);
      const springForce = scale(displacement, -stiffness);
      const dampingForce = scale(velocity, -damping);
      const accel = scale(add(springForce, dampingForce), 1 / mass);
      velocity = add(velocity, scale(accel, dt));
      value = add(value, scale(velocity, dt));
      o.onTick(value);
      if (magnitude(velocity) < restThreshold && magnitude(subtract(value, o.to)) < restThreshold) {
        o.onTick(o.to);
        o.onDone?.();
        return true;
      }
      return false;
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/useAnimator.test.tsx`
Expected: PASS — both tween and spring blocks green.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "$(cat <<'EOF'
feat(animation): spring primitive on useAnimator

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: useAnimator — decay

Add velocity-only decay (used by `momentum`).

**Files:**
- Modify: `src/animation/useAnimator.ts`
- Modify: `src/animation/useAnimator.test.tsx` (append tests)

- [ ] **Step 1: Write the failing test (append)**

```tsx
describe('useAnimator.decay', () => {
  it('integrates velocity with friction until magnitude < threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const ticks: number[] = [];
    const onDone = vi.fn();
    act(() => {
      result.current.decay<number>({
        from: 0,
        velocity: 600, // px/sec
        friction: 0.9,
        threshold: 1,
        add: (a, b) => a + b,
        scale: (v, k) => v * k,
        magnitude: (v) => Math.abs(v),
        onTick: (v) => ticks.push(v),
        onDone,
      });
    });
    for (let i = 0; i < 600; i++) act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
    // Last value should be greater than the first (we moved in the +x direction).
    expect(ticks[ticks.length - 1]).toBeGreaterThan(ticks[0]);
  });

  it('skips immediately when initial |velocity| is below threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      result.current.decay<number>({
        from: 0,
        velocity: 0.1,
        threshold: 1,
        add: (a, b) => a + b,
        scale: (v, k) => v * k,
        magnitude: (v) => Math.abs(v),
        onTick: () => {},
        onDone,
      });
    });
    act(() => clock.advance(16));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t decay`
Expected: FAIL — `decay: not implemented yet (Task 5)`.

- [ ] **Step 3: Replace the `decay` stub in `src/animation/useAnimator.ts`**

```ts
const decay = <T,>(o: DecayOptions<T>): AnimationHandle => {
  const id = nextId.current++;
  const friction = o.friction ?? 0.95;
  const threshold = o.threshold ?? 0.5;
  let value = o.from;
  let velocity = o.velocity;
  let lastTime: number | null = null;

  return register({
    id,
    cancelKey: o.cancelKey,
    tick(nowMs) {
      if (lastTime == null) {
        lastTime = nowMs;
        if (o.magnitude(velocity) < threshold) {
          o.onDone?.();
          return true;
        }
        o.onTick(value);
        return false;
      }
      const dt = Math.min(0.064, (nowMs - lastTime) / 1000);
      lastTime = nowMs;
      // Per-second friction: v *= friction^dt
      velocity = o.scale(velocity, Math.pow(friction, dt));
      value = o.add(value, o.scale(velocity, dt));
      o.onTick(value);
      if (o.magnitude(velocity) < threshold) {
        o.onDone?.();
        return true;
      }
      return false;
    },
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/useAnimator.test.tsx`
Expected: PASS — tween, spring, decay all green.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "$(cat <<'EOF'
feat(animation): decay primitive on useAnimator

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: PoseDescriptor.lerp

Extend `PoseDescriptor<TPose>` with optional `lerp`. Implement on the rect and path descriptors.

**Files:**
- Modify: `src/interactions/actions/resize/geometry.ts`
- Modify: `src/features/paths/poseDescriptor.ts`
- Create: `src/interactions/actions/resize/geometry.lerp.test.ts` (new test file to keep the existing one focused)

- [ ] **Step 1: Write the failing test**

```ts
// src/interactions/actions/resize/geometry.lerp.test.ts
import { describe, expect, it } from 'vitest';
import { RECT_POSE_DESCRIPTOR } from './geometry';

describe('RECT_POSE_DESCRIPTOR.lerp', () => {
  it('interpolates x/y/width/height linearly', () => {
    const a = { x: 0, y: 0, width: 10, height: 20 };
    const b = { x: 100, y: 200, width: 30, height: 40 };
    const m = RECT_POSE_DESCRIPTOR.lerp!(a, b, 0.5);
    expect(m).toEqual({ x: 50, y: 100, width: 20, height: 30 });
  });

  it('endpoints reproduce exactly', () => {
    const a = { x: 1, y: 2, width: 3, height: 4 };
    const b = { x: 5, y: 6, width: 7, height: 8 };
    expect(RECT_POSE_DESCRIPTOR.lerp!(a, b, 0)).toEqual(a);
    expect(RECT_POSE_DESCRIPTOR.lerp!(a, b, 1)).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/interactions/actions/resize/geometry.lerp.test.ts`
Expected: FAIL — `lerp` is undefined.

- [ ] **Step 3: Extend `PoseDescriptor` in `src/interactions/actions/resize/geometry.ts`**

Add to the interface (after `intersectsRect`):

```ts
  /** Interpolate between two poses. Optional — animation helpers fall back to
   *  rect-shape lerp when omitted (which fails for non-rect poses). */
  lerp?(a: TPose, b: TPose, t: number): TPose;
```

Add to `RECT_POSE_DESCRIPTOR`:

```ts
  lerp: (a, b, t) => ({
    ...a,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
  }),
```

- [ ] **Step 4: Implement `lerp` on `pathPoseDescriptor`**

In `src/features/paths/poseDescriptor.ts`, add the field to the descriptor object:

```ts
  lerp: (a, b, t) => {
    if (a.kind === 'rect' && b.kind === 'rect') {
      return {
        kind: 'rect',
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        width: a.width + (b.width - a.width) * t,
        height: a.height + (b.height - a.height) * t,
      };
    }
    if (a.kind === 'polygon' && b.kind === 'polygon' && a.coords.length === b.coords.length) {
      const next = new Float32Array(a.coords.length);
      for (let i = 0; i < a.coords.length; i++) {
        next[i] = a.coords[i] + (b.coords[i] - a.coords[i]) * t;
      }
      return { kind: 'polygon', commands: a.commands, coords: next, fillRule: a.fillRule };
    }
    throw new Error('pathPoseDescriptor.lerp: incompatible path shapes');
  },
```

- [ ] **Step 5: Add a path lerp test (append to `src/features/paths/poseDescriptor.test.ts` if it exists; otherwise create that file)**

```ts
// src/features/paths/poseDescriptor.test.ts (create if missing)
import { describe, expect, it } from 'vitest';
import { pathPoseDescriptor } from './poseDescriptor';

describe('pathPoseDescriptor.lerp', () => {
  it('interpolates rect paths linearly', () => {
    const a = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;
    const b = { kind: 'rect', x: 10, y: 10, width: 20, height: 20 } as const;
    expect(pathPoseDescriptor.lerp!(a, b, 0.5)).toEqual({
      kind: 'rect', x: 5, y: 5, width: 15, height: 15,
    });
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/interactions/actions/resize/geometry.lerp.test.ts src/features/paths/poseDescriptor.test.ts`
Expected: PASS.

- [ ] **Step 7: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/interactions/actions/resize/geometry.ts src/interactions/actions/resize/geometry.lerp.test.ts src/features/paths/poseDescriptor.ts src/features/paths/poseDescriptor.test.ts
git commit -m "$(cat <<'EOF'
feat(geometry): add lerp to PoseDescriptor (rect + path)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Pose helpers — `tweenPose` and `springPose`

Bridge the animator to a `SceneAdapter`'s `setPose`, with optional op recording.

**Files:**
- Create: `src/animation/poseHelpers.ts`
- Create: `src/animation/poseHelpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/animation/poseHelpers.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { tweenPose } from './poseHelpers';
import type { Op } from '../core/ops/types';

interface RectPose { x: number; y: number; width: number; height: number }
interface Obj { id: string }

function makeAdapter(initial: Map<string, RectPose>) {
  const ops: { ops: Op[]; label: string }[] = [];
  const adapter = {
    getNodes: () => [],
    getNode: (id: string): Obj | undefined => (initial.has(id) ? { id } : undefined),
    getSelection: () => [],
    hitTest: () => null,
    getPose: (id: string) => initial.get(id)!,
    getParent: () => null,
    setPose: vi.fn((id: string, pose: RectPose) => {
      initial.set(id, pose);
    }),
    setParent: () => {},
    insertNode: () => {},
    removeNode: () => {},
    setSelection: () => {},
    applyBatch: vi.fn((batch: Op[], label: string) => {
      ops.push({ ops: batch, label });
    }),
  };
  return { adapter, ops };
}

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

describe('tweenPose', () => {
  it('records one transform op at start, then writes through setPose per frame', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter, ops } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 100, y: 0, width: 10, height: 10 },
        ms: 100,
      });
    });
    expect(ops).toHaveLength(1);
    expect(ops[0].ops).toHaveLength(1);
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    act(() => clock.advance(50));
    const last = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1];
    expect(last.x).toBeCloseTo(100, 1);
    // No additional op batches recorded for in-flight frames.
    expect(ops).toHaveLength(1);
  });

  it('recordOp: false skips the op emit', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter, ops } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 5, y: 0, width: 10, height: 10 },
        ms: 50,
        recordOp: false,
      });
    });
    expect(ops).toHaveLength(0);
  });

  it('cancelKey collisions cancel the prior tween (new tween starts from current value)', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { adapter } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 100, y: 0, width: 10, height: 10 },
        ms: 1000,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100)); // partial progress
    const midX = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1].x;
    act(() => {
      tweenPose(result.current, adapter as never, {
        id: 'a',
        to: { x: 0, y: 0, width: 10, height: 10 },
        ms: 100,
      });
    });
    act(() => clock.advance(0));
    // First frame of the second tween emits the live current pose (~midX),
    // not 0.
    const firstOfSecond = adapter.setPose.mock.calls[adapter.setPose.mock.calls.length - 1][1].x;
    expect(firstOfSecond).toBeCloseTo(midX, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/poseHelpers.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/poseHelpers.ts`**

```ts
import { createTransformOp } from '../core/ops/transform';
import { RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '../interactions/actions/resize/geometry';
import type { SceneAdapter } from '../core/adapters/types';
import type { AnimationHandle, Animator, EasingFn, SpringPresetName } from './types';

export interface TweenPoseOptions<TPose> {
  id: string;
  to: TPose;
  ms: number;
  easing?: EasingFn;
  /** Pose descriptor with a `lerp(from, to, t)` method. Defaults to
   *  `RECT_POSE_DESCRIPTOR`, which interpolates x/y/width/height linearly. */
  geometry?: PoseDescriptor<TPose>;
  /** When true (default), emit a transform op before the tween so undo
   *  restores the pre-animation pose. */
  recordOp?: boolean;
  /** Label for the recorded op. Default: `'animate'`. */
  opLabel?: string;
  onDone?: () => void;
}

export interface SpringPoseOptions<TPose> {
  id: string;
  to: TPose;
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  geometry?: PoseDescriptor<TPose>;
  recordOp?: boolean;
  opLabel?: string;
  onDone?: () => void;
}

const cancelKeyFor = (id: string): string => `pose:${id}`;

function recordTransformOp<TPose>(
  adapter: SceneAdapter<{ id: string }, TPose>,
  id: string,
  from: TPose,
  to: TPose,
  label: string,
): void {
  if (!adapter.applyBatch) return;
  const op = createTransformOp<TPose>({ id, from, to, label });
  adapter.applyBatch([op], label);
}

export function tweenPose<TNode extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TNode, TPose>,
  opts: TweenPoseOptions<TPose>,
): AnimationHandle {
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>));
  if (!geometry.lerp) {
    throw new Error('tweenPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  if (recordOp) recordTransformOp(adapter as never, opts.id, from, opts.to, label);
  return animator.tween<TPose>({
    from,
    to: opts.to,
    ms: opts.ms,
    easing: opts.easing,
    cancelKey: cancelKeyFor(opts.id),
    interpolate: (a, b, t) => lerp(a, b, t),
    onTick: (value) => adapter.setPose(opts.id, value),
    onDone: opts.onDone,
  });
}

export function springPose<TNode extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TNode, TPose>,
  opts: SpringPoseOptions<TPose>,
): AnimationHandle {
  const geometry = (opts.geometry ?? (RECT_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>));
  if (!geometry.lerp) {
    throw new Error('springPose: geometry has no lerp; supply geometry: { ..., lerp }');
  }
  const lerp = geometry.lerp;
  const from = adapter.getPose(opts.id);
  const recordOp = opts.recordOp ?? true;
  const label = opts.opLabel ?? 'animate';
  if (recordOp) recordTransformOp(adapter as never, opts.id, from, opts.to, label);
  // For pose springs: integrate progress (0..1) as the spring's value, then
  // use lerp(from, to, progress) for the actual visual write. This avoids
  // requiring full add/subtract/scale/magnitude on TPose.
  const progressLerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return animator.spring<number>({
    from: 0,
    to: 1,
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    cancelKey: cancelKeyFor(opts.id),
    interpolate: progressLerp,
    onTick: (progress) => adapter.setPose(opts.id, lerp(from, opts.to, progress)),
    onDone: opts.onDone,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/poseHelpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/poseHelpers.ts src/animation/poseHelpers.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): tweenPose / springPose adapter bridge

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `animateOnSetPose` wrapper

Wrap an adapter so programmatic `setPose` calls tween instead of teleport.

**Files:**
- Create: `src/animation/wrappers/animateOnSetPose.ts`
- Create: `src/animation/wrappers/animateOnSetPose.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/animation/wrappers/animateOnSetPose.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { animateOnSetPose } from './animateOnSetPose';
import type { Op } from '../../core/ops/types';

interface RectPose { x: number; y: number; width: number; height: number }
function makeAdapter(initial: Map<string, RectPose>) {
  const setPose = vi.fn((id: string, pose: RectPose) => initial.set(id, pose));
  const applyBatch = vi.fn((_ops: Op[], _label: string) => {});
  return {
    base: {
      getNodes: () => [],
      getNode: (id: string) => (initial.has(id) ? { id } : undefined),
      getSelection: () => [],
      hitTest: () => null,
      getPose: (id: string) => initial.get(id)!,
      getParent: () => null,
      setPose,
      setParent: () => {},
      insertNode: () => {},
      removeNode: () => {},
      setSelection: () => {},
      applyBatch,
    },
    setPose,
    applyBatch,
  };
}

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

describe('animateOnSetPose', () => {
  it('intercepts setPose and tweens to the target', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 100 });
    act(() => {
      wrapped.setPose('a', { x: 100, y: 0, width: 10, height: 10 });
    });
    // The wrapper must NOT immediately call base.setPose with the destination.
    const directCalls = setPose.mock.calls.filter((c) => c[1].x === 100);
    expect(directCalls.length).toBe(0);
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.x).toBeCloseTo(100, 1);
  });

  it('records exactly one transform op for the animation', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, { ms: 50 });
    act(() => {
      wrapped.setPose('a', { x: 50, y: 0, width: 10, height: 10 });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    expect(applyBatch).toHaveBeenCalledTimes(1);
  });

  it('shouldAnimate returning false writes through immediately and emits no op', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 10, height: 10 }]]);
    const { base, setPose, applyBatch } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateOnSetPose(base as never, result.current, {
      ms: 100,
      shouldAnimate: () => false,
    });
    act(() => {
      wrapped.setPose('a', { x: 7, y: 0, width: 10, height: 10 });
    });
    expect(setPose).toHaveBeenCalledWith('a', { x: 7, y: 0, width: 10, height: 10 });
    expect(applyBatch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/wrappers/animateOnSetPose.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/wrappers/animateOnSetPose.ts`**

```ts
import { tweenPose, springPose } from '../poseHelpers';
import type { PoseDescriptor } from '../../interactions/actions/resize/geometry';
import type { SceneAdapter } from '../../core/adapters/types';
import type { Animator, EasingFn, SpringPresetName } from '../types';

export interface AnimateOnSetPoseOptions<TPose> {
  /** Default: 200ms tween with easeOut. */
  ms?: number;
  easing?: EasingFn;
  /** Use a spring instead of a duration tween. Mutually exclusive with ms/easing. */
  spring?: {
    preset?: SpringPresetName;
    stiffness?: number;
    damping?: number;
    mass?: number;
  };
  geometry?: PoseDescriptor<TPose>;
  /** Predicate: return false to skip animation and write through immediately. */
  shouldAnimate?: (id: string, from: TPose, to: TPose) => boolean;
  /** Convenience: when true, auto-skip animation if the id is currently being
   *  manipulated by an active gesture. Implementation: see `gestureScope` —
   *  the wrapper consults a shared "in-flight ids" Set if one is provided,
   *  otherwise this option is a no-op (treat as `shouldAnimate` returning true).
   *  Mutually exclusive with `shouldAnimate`. */
  skipDuringGesture?: boolean;
  /** Optional: a Set the kit (or app) populates with ids currently being
   *  manipulated by a gesture. When `skipDuringGesture` is true and the id
   *  is in this Set, the wrapper writes through immediately. */
  gestureScope?: ReadonlySet<string>;
  /** Op label for the recorded transform op. Default: `'animate'`. */
  opLabel?: string;
}

export function animateOnSetPose<TNode extends { id: string }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  animator: Animator,
  opts: AnimateOnSetPoseOptions<TPose> = {},
): SceneAdapter<TNode, TPose> {
  const ms = opts.ms ?? 200;
  const skipPredicate = (id: string, from: TPose, to: TPose): boolean => {
    if (opts.shouldAnimate) return !opts.shouldAnimate(id, from, to);
    if (opts.skipDuringGesture && opts.gestureScope?.has(id)) return true;
    return false;
  };

  return {
    ...adapter,
    setPose(id: string, pose: TPose): void {
      const from = adapter.getPose(id);
      if (skipPredicate(id, from, pose)) {
        adapter.setPose(id, pose);
        return;
      }
      if (opts.spring) {
        springPose(animator, adapter as never, {
          id,
          to: pose,
          preset: opts.spring.preset,
          stiffness: opts.spring.stiffness,
          damping: opts.spring.damping,
          mass: opts.spring.mass,
          geometry: opts.geometry,
          opLabel: opts.opLabel,
        });
      } else {
        tweenPose(animator, adapter as never, {
          id,
          to: pose,
          ms,
          easing: opts.easing,
          geometry: opts.geometry,
          opLabel: opts.opLabel,
        });
      }
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/wrappers/animateOnSetPose.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/wrappers/animateOnSetPose.ts src/animation/wrappers/animateOnSetPose.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): animateOnSetPose adapter wrapper

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `animateLifecycle` wrapper

Wrap insert/remove so they tween from `enterFrom` and to `exitTo` respectively. Underlying `removeNode` only fires after the exit tween settles.

**Files:**
- Create: `src/animation/wrappers/animateLifecycle.ts`
- Create: `src/animation/wrappers/animateLifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/animation/wrappers/animateLifecycle.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { animateLifecycle } from './animateLifecycle';

interface RectPose { x: number; y: number; width: number; height: number }
interface Obj { id: string; pose: RectPose }

function makeAdapter(initial: Map<string, RectPose>) {
  const insertNode = vi.fn((o: Obj) => initial.set(o.id, o.pose));
  const removeNode = vi.fn((id: string) => initial.delete(id));
  const setPose = vi.fn((id: string, p: RectPose) => initial.set(id, p));
  return {
    base: {
      getNodes: () => [],
      getNode: (id: string) => (initial.has(id) ? { id, pose: initial.get(id)! } : undefined),
      getSelection: () => [],
      hitTest: () => null,
      getPose: (id: string) => initial.get(id)!,
      getParent: () => null,
      setPose,
      setParent: () => {},
      insertNode,
      removeNode,
      setSelection: () => {},
    },
    insertNode,
    removeNode,
    setPose,
  };
}

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

describe('animateLifecycle.insert', () => {
  it('inserts immediately, then tweens visible pose from enterFrom to final', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>();
    const { base, insertNode, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base as never, result.current, {
      enterFrom: (p) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => {
      wrapped.insertNode({ id: 'a', pose: { x: 10, y: 10, width: 20, height: 20 } } as never);
    });
    expect(insertNode).toHaveBeenCalledTimes(1);
    // First setPose call should have set the entry pose (width 0).
    expect(setPose).toHaveBeenCalledWith('a', { x: 10, y: 10, width: 0, height: 0 });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.width).toBeCloseTo(20, 1);
    expect(last.height).toBeCloseTo(20, 1);
  });
});

describe('animateLifecycle.remove', () => {
  it('tweens to exitTo first, calls removeNode only after settle', () => {
    const clock = makeClock();
    const initial = new Map<string, RectPose>([['a', { x: 0, y: 0, width: 20, height: 20 }]]);
    const { base, removeNode, setPose } = makeAdapter(initial);
    const { result } = renderHook(() => useAnimator(clock));
    const wrapped = animateLifecycle(base as never, result.current, {
      exitTo: (p) => ({ ...p, width: 0, height: 0 }),
      ms: 100,
    });
    act(() => {
      wrapped.removeNode('a');
    });
    expect(removeNode).not.toHaveBeenCalled();
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    const last = setPose.mock.calls[setPose.mock.calls.length - 1][1];
    expect(last.width).toBeCloseTo(0, 1);
    expect(removeNode).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/wrappers/animateLifecycle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/wrappers/animateLifecycle.ts`**

```ts
import { tweenPose } from '../poseHelpers';
import type { PoseDescriptor } from '../../interactions/actions/resize/geometry';
import type { SceneAdapter } from '../../core/adapters/types';
import type { Animator, EasingFn } from '../types';

export interface LifecycleAnimation<TPose> {
  /** Pose to animate the new object FROM at insert. */
  enterFrom?: (final: TPose) => TPose;
  /** Pose to animate the existing object TO at remove. */
  exitTo?: (current: TPose) => TPose;
  ms?: number;
  easing?: EasingFn;
  geometry?: PoseDescriptor<TPose>;
}

export function animateLifecycle<TNode extends { id: string; pose?: TPose }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): SceneAdapter<TNode, TPose> {
  const ms = opts.ms ?? 200;

  return {
    ...adapter,
    insertNode(object: TNode): void {
      adapter.insertNode(object);
      if (!opts.enterFrom) return;
      const final = adapter.getPose(object.id);
      const start = opts.enterFrom(final);
      adapter.setPose(object.id, start);
      tweenPose(animator, adapter as never, {
        id: object.id,
        to: final,
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
      });
    },
    removeNode(id: string): void {
      if (!opts.exitTo) {
        adapter.removeNode(id);
        return;
      }
      const current = adapter.getPose(id);
      tweenPose(animator, adapter as never, {
        id,
        to: opts.exitTo(current),
        ms,
        easing: opts.easing,
        geometry: opts.geometry,
        recordOp: false,
        onDone: () => adapter.removeNode(id),
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/wrappers/animateLifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/wrappers/animateLifecycle.ts src/animation/wrappers/animateLifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): animateLifecycle wrapper for enter/exit

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Wrappers barrel

**Files:**
- Create: `src/animation/wrappers/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
export { animateOnSetPose, type AnimateOnSetPoseOptions } from './animateOnSetPose';
export { animateLifecycle, type LifecycleAnimation } from './animateLifecycle';
```

- [ ] **Step 2: Run typecheck and full suite**

Run: `npm run typecheck && npm test -- --run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/animation/wrappers/index.ts
git commit -m "$(cat <<'EOF'
feat(animation): barrel for adapter wrappers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: `momentum` MoveBehavior

Records pointer velocity in `ctx.scratch` during the gesture. On `onEnd`, if velocity exceeds threshold, suppresses the default commit and fires `animator.decay`. The decay translates the dragged pose per frame and commits a final transform op when it settles.

**Files:**
- Create: `src/animation/behaviors/momentum.ts`
- Create: `src/animation/behaviors/momentum.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/animation/behaviors/momentum.test.ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { momentum } from './momentum';
import type { GestureContext } from '../../interactions/gestures/types';

interface RectPose { x: number; y: number; width: number; height: number }

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => { now += dt; const due = [...cbs.values()]; cbs.clear(); for (const cb of due) cb(now); },
  };
}

function makeCtx(initialPose: RectPose, setPose: (id: string, p: RectPose) => void): GestureContext<RectPose> {
  return {
    draggedIds: ['a'],
    origin: new Map([['a', { ...initialPose }]]),
    current: new Map([['a', { ...initialPose }]]),
    snap: null,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false } as never,
    pointer: { worldX: 0, worldY: 0, clientX: 0, clientY: 0 } as never,
    adapter: {
      getNode: () => ({ id: 'a' }),
      getNodes: () => [{ id: 'a' }],
      getPose: (id: string) => initialPose,
      getParent: () => null,
      setPose: (id: string, p: RectPose) => { setPose(id, p); },
      setParent: () => {},
    },
    scratch: {},
  };
}

describe('momentum', () => {
  it('records pointer samples on each onMove', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const beh = momentum<RectPose>({ animator: result.current });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    ctx.pointer = { worldX: 10, worldY: 0, clientX: 10, clientY: 0 } as never;
    beh.onMove?.(ctx, ctx.current.get('a')!);
    ctx.pointer = { worldX: 20, worldY: 0, clientX: 20, clientY: 0 } as never;
    beh.onMove?.(ctx, ctx.current.get('a')!);
    expect(ctx.scratch['momentum.samples']).toBeDefined();
  });

  it('suppresses default commit and fires decay when release velocity exceeds threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 0 });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    // Two samples 16ms apart at +10px each → ~625 px/sec
    (ctx as { pointer: { worldX: number; worldY: number; clientX: number; clientY: number } }).pointer = {
      worldX: 0, worldY: 0, clientX: 0, clientY: 0,
    };
    beh.onMove?.(ctx, ctx.current.get('a')!);
    clock.advance(16);
    (ctx as { pointer: { worldX: number; worldY: number; clientX: number; clientY: number } }).pointer = {
      worldX: 10, worldY: 0, clientX: 10, clientY: 0,
    };
    beh.onMove?.(ctx, ctx.current.get('a')!);
    clock.advance(16);
    (ctx as { pointer: { worldX: number; worldY: number; clientX: number; clientY: number } }).pointer = {
      worldX: 20, worldY: 0, clientX: 20, clientY: 0,
    };
    beh.onMove?.(ctx, ctx.current.get('a')!);
    const ops = beh.onEnd?.(ctx);
    expect(ops).toBeNull(); // suppress default commit
    expect(decaySpy).toHaveBeenCalledTimes(1);
  });

  it('returns undefined (defer to default) when release velocity is below threshold', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const decaySpy = vi.spyOn(result.current, 'decay');
    const beh = momentum<RectPose>({ animator: result.current, threshold: 10000 });
    const setPose = vi.fn();
    const ctx = makeCtx({ x: 0, y: 0, width: 10, height: 10 }, setPose);
    beh.onStart?.(ctx);
    beh.onMove?.(ctx, ctx.current.get('a')!);
    const ops = beh.onEnd?.(ctx);
    expect(ops).toBeUndefined();
    expect(decaySpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/behaviors/momentum.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/animation/behaviors/momentum.ts`**

```ts
import { createTransformOp } from '../../core/ops/transform';
import type { Op } from '../../core/ops/types';
import type { MoveBehavior, GestureContext } from '../../interactions/gestures/types';
import type { Animator } from '../types';

export interface MomentumOptions {
  /** Required: the per-Canvas animator that will own the decay. */
  animator: Animator;
  friction?: number;     // default 0.92 (per second)
  threshold?: number;    // default 200 px/sec
  /** Sample window in ms for velocity computation. Default 80ms. */
  velocitySampleMs?: number;
}

interface PointerSample {
  t: number;       // ms timestamp
  x: number;
  y: number;
}

interface RectLike { x: number; y: number }

const SAMPLES_KEY = 'momentum.samples';

export function momentum<TPose>(opts: MomentumOptions): MoveBehavior<TPose> {
  const friction = opts.friction ?? 0.92;
  const threshold = opts.threshold ?? 200;
  const sampleMs = opts.velocitySampleMs ?? 80;

  const recordSample = (ctx: GestureContext<TPose>): void => {
    const samples = (ctx.scratch[SAMPLES_KEY] ??= []) as PointerSample[];
    samples.push({
      t: Date.now(),
      x: ctx.pointer.worldX,
      y: ctx.pointer.worldY,
    });
    // Trim anything older than 4× the sample window — bounded memory.
    const cutoff = Date.now() - sampleMs * 4;
    while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
  };

  return {
    onStart(ctx) {
      ctx.scratch[SAMPLES_KEY] = [];
      recordSample(ctx);
    },
    onMove(ctx) {
      recordSample(ctx);
    },
    onEnd(ctx): Op[] | null | undefined {
      const samples = (ctx.scratch[SAMPLES_KEY] ?? []) as PointerSample[];
      if (samples.length < 2) return undefined;
      const last = samples[samples.length - 1];
      // Find the oldest sample within `sampleMs` of `last`.
      const cutoff = last.t - sampleMs;
      let first = samples[0];
      for (const s of samples) {
        if (s.t >= cutoff) { first = s; break; }
      }
      const dt = (last.t - first.t) / 1000;
      if (dt <= 0) return undefined;
      const vx = (last.x - first.x) / dt;
      const vy = (last.y - first.y) / dt;
      const speed = Math.hypot(vx, vy);
      if (speed < threshold) return undefined;

      // Suppress default commit and fire decay. We translate each dragged id
      // by the per-frame delta and commit one transform op per id when done.
      const startPoses = new Map<string, TPose>(ctx.current);
      let lastValue = { x: 0, y: 0 };
      opts.animator.decay<RectLike>({
        from: { x: 0, y: 0 },
        velocity: { x: vx, y: vy },
        friction,
        add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
        scale: (v, k) => ({ x: v.x * k, y: v.y * k }),
        magnitude: (v) => Math.hypot(v.x, v.y),
        onTick: (delta) => {
          lastValue = delta;
          for (const id of ctx.draggedIds) {
            const start = startPoses.get(id) as unknown as RectLike & TPose;
            if (!start) continue;
            ctx.adapter.setPose(id, { ...start, x: start.x + delta.x, y: start.y + delta.y } as TPose);
          }
        },
        onDone: () => {
          if (!ctx.adapter.applyBatch) return;
          const ops: Op[] = [];
          for (const id of ctx.draggedIds) {
            const start = startPoses.get(id) as unknown as RectLike & TPose;
            if (!start) continue;
            const finalPose = { ...start, x: start.x + lastValue.x, y: start.y + lastValue.y } as TPose;
            ops.push(createTransformOp<TPose>({ id, from: start, to: finalPose, label: 'flick' }));
          }
          if (ops.length > 0) ctx.adapter.applyBatch(ops, 'flick');
        },
      });
      return null;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/animation/behaviors/momentum.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/animation/behaviors/momentum.ts src/animation/behaviors/momentum.test.ts
git commit -m "$(cat <<'EOF'
feat(animation): momentum MoveBehavior with decay-on-release

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Top-level barrel + index export

**Files:**
- Create: `src/animation/index.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create `src/animation/index.ts`**

```ts
export * from './types';
export {
  linear, easeIn, easeOut, easeInOut, SPRING_PRESETS,
} from './easings';
export { useAnimator } from './useAnimator';
export {
  tweenPose, springPose,
  type TweenPoseOptions, type SpringPoseOptions,
} from './poseHelpers';
export * from './wrappers';
export { momentum, type MomentumOptions } from './behaviors/momentum';
```

- [ ] **Step 2: Add to `src/index.ts`**

Append (the existing file already uses `export *` style for module barrels):

```ts
export * from './animation';
```

- [ ] **Step 3: Run typecheck and full suite**

Run: `npm run typecheck && npm test -- --run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/animation/index.ts src/index.ts
git commit -m "$(cat <<'EOF'
feat(animation): top-level barrel and re-export from package root

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: AnimationDemo

Three buttons / interactions in one demo, registered alongside the other demos.

**Files:**
- Create: `demo/demos/AnimationDemo.tsx`
- Modify: the demo registry (look for where the other demos are registered — typically `demo/index.tsx` or `demo/App.tsx`; find by `grep -rn 'MoveDemo' demo/ --include="*.tsx"`)

- [ ] **Step 1: Locate the demo registry**

Run: `grep -rn 'MoveDemo' demo/ --include="*.tsx" | head`
Expected: returns the file that imports `MoveDemo` and registers it. Modify that same file.

- [ ] **Step 2: Create `demo/demos/AnimationDemo.tsx`**

The demo MUST render through `<Canvas>` (or `<SceneCanvas>`), not a raw `canvasRef`. Use cream `#d4c4a8` (or `handles.fill`) for any new chrome — the demo backdrop is dark, so never draw dark-on-dark. Mirror the structure of `demo/demos/MoveDemo.tsx` for adapter setup, scene rendering, and tool wiring.

```tsx
import { useMemo, useState } from 'react';
import {
  Canvas,
  animateLifecycle,
  animateOnSetPose,
  momentum,
  useAnimator,
  useArrayAdapter,
  useMove,
  useSelectTool,
  useTools,
} from '../../src';

interface Card {
  id: string;
  pose: { x: number; y: number; width: number; height: number };
  color: string;
}

const INITIAL: Card[] = [
  { id: 'a', pose: { x: 100, y: 100, width: 80, height: 60 }, color: '#d4c4a8' },
  { id: 'b', pose: { x: 220, y: 100, width: 80, height: 60 }, color: '#c4d4a8' },
  { id: 'c', pose: { x: 340, y: 100, width: 80, height: 60 }, color: '#a8c4d4' },
];

export function AnimationDemo(): JSX.Element {
  const [scene, setScene] = useState<Card[]>(INITIAL);
  const baseAdapter = useArrayAdapter(scene, setScene, {
    getPose: (c) => c.pose,
    setPose: (c, pose) => ({ ...c, pose }),
  });
  const animator = useAnimator();

  const adapter = useMemo(
    () =>
      animateLifecycle(
        animateOnSetPose(baseAdapter, animator, { ms: 250 }),
        animator,
        {
          enterFrom: (p) => ({ ...p, width: 0, height: 0 }),
          exitTo: (p) => ({ ...p, width: 0, height: 0 }),
          ms: 250,
        },
      ),
    [baseAdapter, animator],
  );

  const move = useMove(adapter, {
    behaviors: [momentum({ animator, friction: 0.93 })],
  });
  const select = useSelectTool({ adapter, move });
  const tools = useTools({ active: select });

  const tweenTo = (id: string, x: number, y: number) => {
    const c = scene.find((s) => s.id === id);
    if (!c) return;
    adapter.setPose(id, { ...c.pose, x, y });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => tweenTo('a', 400, 200)}>Tween A → (400, 200)</button>
        <button onClick={() => tweenTo('b', 100, 300)}>Tween B → (100, 300)</button>
        <button onClick={() => setScene((s) => [
          ...s,
          { id: `n${s.length}`, pose: { x: 200, y: 250, width: 60, height: 60 }, color: '#d4c4a8' },
        ])}>Add card</button>
      </div>
      <Canvas adapter={adapter} tools={tools} width={600} height={400}>
        {scene.map((c) => (
          <rect key={c.id} {...c.pose} fill={c.color} />
        ))}
      </Canvas>
    </div>
  );
}
```

NOTE: the exact shape of `Canvas` children, `useArrayAdapter` options, and `useSelectTool` arguments may differ from what's shown above — when implementing this task, conform to the patterns already used by `demo/demos/MoveDemo.tsx` (read it first). The point of this task is "use the kit's `<Canvas>` + adapter wrappers; show off animateOnSetPose, animateLifecycle, and momentum."

- [ ] **Step 3: Register the demo**

In the demo registry file from Step 1, add an `import { AnimationDemo } from './demos/AnimationDemo';` and register it next to the other demos (mirror exactly how `MoveDemo` is registered).

- [ ] **Step 4: Run typecheck and full suite**

Run: `npm run typecheck && npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Verify the demo renders**

Run: `npm run dev` (or whatever the dev-server script is — check `package.json`'s `scripts`)
Open the AnimationDemo in the browser. Verify:
- Click "Tween A → (400, 200)": card A slides over ~250ms.
- Click "Add card": a new card scales up from zero.
- Drag a card and flick: it continues sliding after pointer release, decelerating.

If any of these fail, report back; do not invent fixes that go beyond the spec.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/AnimationDemo.tsx <demo registry file>
git commit -m "$(cat <<'EOF'
feat(demo): AnimationDemo showing tween, lifecycle, and momentum

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Demo integration test

**Files:**
- Create: `demo/demos/__tests__/animationDemo.integration.test.tsx`

- [ ] **Step 1: Write the test**

```tsx
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AnimationDemo } from '../AnimationDemo';

describe('AnimationDemo', () => {
  it('renders the canvas and the three control buttons', () => {
    render(<AnimationDemo />);
    expect(screen.getByRole('button', { name: /Tween A/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tween B/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add card/i })).toBeInTheDocument();
  });

  it('clicking "Add card" appends an object to the scene', () => {
    const { container } = render(<AnimationDemo />);
    const before = container.querySelectorAll('rect').length;
    fireEvent.click(screen.getByRole('button', { name: /Add card/i }));
    // Scene state updates synchronously; the new rect appears even though
    // its visible pose is mid-tween.
    const after = container.querySelectorAll('rect').length;
    expect(after).toBe(before + 1);
  });
});
```

NOTE: if the kit's `<Canvas>` renders to `<canvas>` (raster) rather than `<svg>`, querying `rect` won't work. In that case, swap the assertion to count via the adapter (e.g., expose a data attribute on the wrapping div, or call `getNodes()` on a hoisted adapter). The reviewer should reject the test if it asserts on something that doesn't exist in the rendered output.

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run demo/demos/__tests__/animationDemo.integration.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add demo/demos/__tests__/animationDemo.integration.test.tsx
git commit -m "$(cat <<'EOF'
test(demo): AnimationDemo integration smoke test

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: TODO bookkeeping

Per project policy on deferrals: every deferral promised in the spec needs a TODO entry, and the spec's "this is now built" item must come off Tier 1.

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Read the current TODO**

Read `docs/TODO.md` to find:
- The "Animation as a primitive concept" entry under Tier 1 — remove it.
- The location of the "Deferred from completed work" / "Future iterations" section (or whatever the project uses for landed-and-deferred items). If no such section exists, add one near the bottom under a `## Deferred` heading.

- [ ] **Step 2: Remove the resolved entry from Tier 1**

Edit `docs/TODO.md` to drop the "Animation as a primitive concept" line.

- [ ] **Step 3: Append deferred items**

Append (under the appropriate section) the following — these come from the spec's "Deferred / out of scope" section verbatim, condensed to one line each:

```markdown
### Deferred from animation primitive (2026-05-04)

- Ambient / looping animations — `loop({...})` convenience helper. Primitive supports it via self-retriggering tween; ship sugar when a real consumer wants it.
- Spring "no destination" mode — unify `spring`/`decay` if the seam pinches.
- Animation events / observability — global subscribe API for debug overlays / analytics.
- Synchronized animations / staggers — "animate N objects with 50ms stagger" one-liner.
- Animation-aware undo — "rewind the animation" instead of cancel + jump.
- GPU / Web Animations API bridge — offload to compositor for very large concurrent counts.
- Scroll-driven / pointer-driven progress — animation progress as a function of an external value, not time.
- Easing function library — `easeOutBack`, `easeInElastic`, etc.
- Animator pause / resume / time-scale — useful for debugging.
- Layout-strategy reflow integration — explicit hookup; today consumers compose `animateOnSetPose` over a layout-driven adapter.
```

- [ ] **Step 4: Run full suite**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/TODO.md
git commit -m "$(cat <<'EOF'
docs(todo): close animation primitive, log deferred items

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Spec coverage cross-reference

| Spec section | Plan task |
| --- | --- |
| Animator API (`tween`, `spring`, `decay`, `cancel*`, `isActive`) | Tasks 1, 3, 4, 5 |
| Built-in easings + spring presets | Task 2 |
| Pose helpers (`tweenPose`, `springPose`) | Task 7 |
| `PoseDescriptor.lerp` | Task 6 |
| `animateOnSetPose` (with `skipDuringGesture`) | Task 8 |
| `animateLifecycle` | Task 9 |
| `momentum` MoveBehavior | Task 11 |
| Op-log policy (one op at start, in-flight bypass) | Tasks 7, 8, 11 (assertions in tests) |
| Cancellation semantics (cancelKey, cancel, cancelAll) | Tasks 3, 4, 5, 7 |
| Frame loop ownership (per-Canvas, sleeps when empty) | Task 3 (the rAF-stops-on-settle test) |
| Composition example | Task 13 (AnimationDemo) |
| Demo + integration test | Tasks 13, 14 |
| Index re-export | Tasks 10, 12 |
| Deferred items tracked | Task 15 |
