# Camera Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the viewport `View` animatable through the kit's `Animator`, and wire `viewport.animatedZoom` — declared since May and read by nothing — to it, so Cmd+=/-/0 glides instead of jumping.

**Architecture:** One runner per canvas. `useViewAnimation(view, animator?)` registers a single `animator.tween<View>` under `cancelKey: 'view'`, interpolated by `interpolateView` (geometric scale, fixed anchor), writing each frame through the canvas's existing view channel — which on an uncontrolled canvas is `handle.setView`, costing no React render. The runner is exposed three ways: as the hook, as new optional members on the `view` dep (`animate` / `stopAnimation` / `animationTarget`), and on `SceneCanvasApi` (`animateView` / `stopViewAnimation` / `isViewAnimating`). `viewportZoomAction` gains an `animate` option that routes only its discrete branches (`in` / `out` / `reset`) through the dep; wheel and pinch keep calling `view.set`. Any view write the runner did not make cancels it. `useViewTween` is deleted.

**Tech Stack:** TypeScript, React 19, vitest + @testing-library/react (project `kit`).

**Design source:** `docs/superpowers/specs/2026-08-25-camera-animation-design.md`.

**Branch note:** the `mac-pinch-zoom` branch (`0dd35a19`) touches three of the same files — it removed the false demo blurbs, marked `animatedZoom` unimplemented in `SceneCanvasProps`, and moved `viewport.pinchZoom` onto `makePinchZoomAction`. Rebase onto it (or onto whatever trunk carries it) before starting. Task 9 assumes its blurb edits are present; if they are not, that task's job is to *check* the claims rather than restore them.

---

## File Structure

**Created:**

- `packages/core/src/core/viewport/interpolateView.ts` — `InterpolatorFactory<View>`: geometric scale, fixed anchor, linear translation on a pure pan.
- `packages/core/src/core/viewport/interpolateView.test.ts`
- `packages/core/src/canvas/deps/view.test.ts` — the `view` dep's animation members and its cancel-on-set.
- `packages/core/src/canvas/SceneCanvas.recenter.types.test.ts` — pins the widened `recenter` return type.
- `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx` — end-to-end on the Mac platform branch: Cmd+= glides, a pan cancels it, and the glide costs no commit.
- `.changeset/camera-animation.md`

**Modified:**

- `packages/core/src/core/viewport/useViewAnimation.ts` — rewritten on `Animator`. New signature and return type; `animateToBounds` kept.
- `packages/core/src/core/viewport/useViewAnimation.test.ts` — rewritten against the new API.
- `packages/core/src/index.ts` — drops `useViewTween`, adds `interpolateView` and the new types (`:250-258`, `:1120`).
- `packages/core/src/index.barrel.test.ts` — asserts the barrel's new shape.
- `packages/core/src/interactions/actions/depSchema.ts` — `ViewApi` gains `animate` / `stopAnimation` / `animationTarget`; `recenter` widens to `() => View | void` (`:51-66`).
- `packages/core/src/canvas/deps/view.ts` — `useViewDepSource` takes the runner, publishes the three members, and cancels on external `set`.
- `packages/core/src/interactions/actions/defaults/viewportZoom.ts` — `ViewportZoomOptions.animate`; discrete branches route through `view.animate`.
- `packages/core/src/interactions/actions/defaults/viewportZoom.test.ts` — animation branches.
- `packages/core/src/canvas/SceneCanvas.tsx` — camera animator + runner, `animatedZoom` → action options (`:601`, `:613`, `:1949`, `:1835-1846`, `:2423`).
- `packages/core/src/canvas/SceneCanvas/useViewportActions.ts` — one comment about `zoomKey` and function-valued options.
- `packages/core/src/canvas/canvasExtension.ts` — `SceneCanvasApi` gains the three camera members.
- `docs/hooks.md:215`
- `apps/site/registry.ts:341-344`, `apps/site/demos/ViewportDemo.tsx:100`

**Deleted:**

- `packages/core/src/core/viewport/useViewTween.ts`
- `packages/core/src/core/viewport/useViewTween.test.ts`

---

## How to test

This repo has a documented history of green suites that meant nothing: the frame-loop arc shipped
six tests that passed against their own mutations, and a 7,000-test green suite coexisted with a
blank canvas in every demo, silently uncompiled shaders, a doubled zoom factor, and double-click
text editing broken for twelve days. Every rule below was earned by one of those.

- **Mutation-test every test.** After a test passes, break the line of production code it is
  supposed to be about and confirm *that* test fails. Each task below names the mutation and the
  test that must die. A test that survives its mutation gets rewritten, not kept.
- **`getContext('webgl2')` is stubbed to `null` in `vitest.setup.ts`.** A canvas test only paints
  if it answers like WebGL2. Any assertion about painting needs the GL recorder installed in
  `beforeAll` (see `Canvas.frameLoop.test.tsx`); without it the paint bails early and the
  assertion passes vacuously. No task here asserts pixels — they assert `View` values — so the
  2D-context stub used by `SceneCanvas.actions.behavior.test.tsx` is enough.
- **Count commits with `<Profiler>` around the component under test, never an outer wrapper.** A
  `setState` inside `SceneCanvas` never re-renders its parent, so a wrapper-render counter passes
  against the unfixed code.
- **Inline JSX object literals fire repaints by themselves.** A fresh `layers={{}}` or
  `viewport={{…}}` every render is a new identity. Hoist them to `const` outside the component
  when the test is about render or repaint counts.
- **Refs survive StrictMode's simulated remount** (setup → cleanup → setup). The runner's
  `isAnimating` is derived from `animator.isActive`, not from a ref set in an effect, for exactly
  this reason. Task 2 has a `<StrictMode>` test.
- **`--project=kit packages/hud` matches no files and passes cheerfully.** Test projects are not
  directories. Use `npm run test:unit` for everything.
- **Avoid `toBeGreaterThan`.** Assert the value. "The scale went up" is true of a bug that doubles
  it; `toBeCloseTo(1.25, 10)` is not.
- **"Mounts without error" proves nothing.** `Canvas.viewport.test.tsx:58` is that shape and it is
  why the doubled pinch factor went unnoticed for months. Assert the effect.
- **The suite runs as non-Mac.** jsdom's `navigator.platform` is `''`, which is not nullish, so
  `IS_MAC` fell through to the non-Mac branch for the whole repo's history. Any test of a
  keyboard modifier binding must stub a Mac user agent **before the dispatcher module loads** —
  `vi.hoisted` with `Object.defineProperty(globalThis.navigator, 'userAgent', …)`, because
  `IS_MAC` is a module-level constant. `packages/core/src/interactions/dispatcher/viewport.mac.integration.test.tsx`
  is the worked example; Task 8 copies its preamble.

---

### Task 1: A view interpolator that is anchored and geometric

**Files:**
- Create: `packages/core/src/core/viewport/interpolateView.ts`
- Test: `packages/core/src/core/viewport/interpolateView.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/core/viewport/interpolateView.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { interpolateView } from './interpolateView';
import { zoomAt } from './zoomAt';
import type { View } from './view';

const V = (x: number, y: number, s: number): View => ({ x, y, scale: { x: s, y: s } });

/** The world point drawn at a canvas-local screen point (see `view.ts`). */
const worldAt = (v: View, p: { x: number; y: number }) => ({
  x: p.x / v.scale.x + v.x,
  y: p.y / v.scale.y + v.y,
});

const expectViewCloseTo = (a: View, b: View, digits = 10) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
  expect(a.scale.x).toBeCloseTo(b.scale.x, digits);
  expect(a.scale.y).toBeCloseTo(b.scale.y, digits);
};

describe('interpolateView', () => {
  it('lands on the endpoints at t=0 and t=1', () => {
    const from = V(10, 20, 1);
    const to = zoomAt(from, { x: 240, y: 160 }, 4);
    const f = interpolateView(from, to);
    expectViewCloseTo(f(0), from);
    expectViewCloseTo(f(1), to);
  });

  it('interpolates scale geometrically, not linearly', () => {
    const from = V(0, 0, 1);
    const to = zoomAt(from, { x: 240, y: 160 }, 8);
    const mid = interpolateView(from, to)(0.5);
    // sqrt(1 * 8) = 2.828…; a linear lerp would put this at 4.5.
    expect(mid.scale.x).toBeCloseTo(Math.sqrt(8), 10);
    expect(mid.scale.y).toBeCloseTo(Math.sqrt(8), 10);
  });

  it('holds the zoom anchor under the same screen pixel for the whole tween', () => {
    const anchor = { x: 240, y: 160 };
    const from = V(10, 20, 1.5);
    const to = zoomAt(from, anchor, 3);
    const f = interpolateView(from, to);
    const w = worldAt(from, anchor);
    for (const t of [0, 0.13, 0.5, 0.77, 1]) {
      const at = worldAt(f(t), anchor);
      expect(at.x).toBeCloseTo(w.x, 9);
      expect(at.y).toBeCloseTo(w.y, 9);
    }
  });

  it('lerps translation linearly when the scale does not change', () => {
    const from = V(0, 0, 2);
    const to = V(100, 40, 2);
    expect(interpolateView(from, to)(0.25)).toEqual({ x: 25, y: 10, scale: { x: 2, y: 2 } });
  });

  it('keeps scale positive when an easing overshoots past 1', () => {
    const from = V(0, 0, 1);
    const to = zoomAt(from, { x: 100, y: 100 }, 2);
    expect(interpolateView(from, to)(1.35).scale.x).toBeCloseTo(Math.pow(2, 1.35), 10);
  });

  it('interpolates the two axes independently', () => {
    const from: View = { x: 0, y: 0, scale: { x: 1, y: 4 } };
    const to: View = { x: 0, y: 0, scale: { x: 9, y: 4 } };
    const mid = interpolateView(from, to)(0.5);
    expect(mid.scale.x).toBeCloseTo(3, 10);
    expect(mid.scale.y).toBeCloseTo(4, 10);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/core/viewport/interpolateView.test.ts
```

Expected: the file fails to resolve `./interpolateView` —
`Error: Failed to load url ./interpolateView`, `Test Files  1 failed (1)`.

- [ ] **Step 3: Implement**

Create `packages/core/src/core/viewport/interpolateView.ts`:

```ts
import type { View } from './view';

/**
 * Per-axis camera curve. Two views that differ in scale agree at exactly one
 * screen point; holding the world point under it fixed is what makes a zoom
 * read as anchored rather than drifting. Scale moves geometrically, so each
 * frame changes the view by the same ratio and an overshooting easing cannot
 * produce a non-positive scale.
 */
function axisCurve(x0: number, s0: number, x1: number, s1: number): (t: number) => { x: number; s: number } {
  // Equal scales: no fixed point exists on this axis. That is a pure pan.
  if (Math.abs(s1 - s0) <= 1e-12 * Math.max(Math.abs(s0), Math.abs(s1), 1)) {
    return (t) => ({ x: x0 + (x1 - x0) * t, s: s0 + (s1 - s0) * t });
  }
  const p = (x1 - x0) / (1 / s0 - 1 / s1); // screen px where the two views agree
  const w = p / s0 + x0;                   // the world point under it
  const ratio = s1 / s0;
  return (t) => {
    const s = s0 * Math.pow(ratio, t);
    return { x: w - p / s, s };
  };
}

/**
 * `InterpolatorFactory<View>` for camera animation — built once per animation,
 * called with eased `t` each frame. Pass to `Animator.tween`'s `interpolator`.
 */
export function interpolateView(from: View, to: View): (t: number) => View {
  const fx = axisCurve(from.x, from.scale.x, to.x, to.scale.x);
  const fy = axisCurve(from.y, from.scale.y, to.y, to.scale.y);
  return (t: number): View => {
    const a = fx(t);
    const b = fy(t);
    return { x: a.x, y: b.x, scale: { x: a.s, y: b.s } };
  };
}
```

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/core/viewport/interpolateView.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  6 passed (6)`.

- [ ] **Step 5: Mutation check**

Make each change, run the command, confirm the named test fails, then revert:

1. `const s = s0 + (s1 - s0) * t;` (linear scale) → *interpolates scale geometrically* fails
   (2.828 vs 4.5) **and** *holds the zoom anchor* fails.
2. `return { x: x0 + (x1 - x0) * t, s };` in the zoom branch (lerp translation) → *holds the zoom
   anchor* fails at t=0.5.
3. Swap `b.x` for `a.x` in the returned `y` → *interpolates the two axes independently* fails.

- [ ] **Step 6: Commit**

```
git add packages/core/src/core/viewport/interpolateView.ts packages/core/src/core/viewport/interpolateView.test.ts
git commit -m "$(cat <<'EOF'
add an anchored, geometric interpolator for the camera view

Scale moves by a constant ratio per frame rather than a constant amount, and
translation is derived from the one screen point the two views agree on, so the
point under the zoom anchor stays put for the whole animation. Equal scales have
no such point; that case is a pan and lerps.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Rebuild `useViewAnimation` on the animator

**Files:**
- Modify: `packages/core/src/core/viewport/useViewAnimation.ts` (whole file)
- Delete: `packages/core/src/core/viewport/useViewTween.ts`, `packages/core/src/core/viewport/useViewTween.test.ts`
- Test: `packages/core/src/core/viewport/useViewAnimation.test.ts` (replace contents)

- [ ] **Step 1: Write the failing test**

Replace `packages/core/src/core/viewport/useViewAnimation.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useViewAnimation, type ViewChannel } from './useViewAnimation';
import { useAnimator } from '../../animation/useAnimator';
import { linear } from '../../animation/easings';
import { zoomAt } from './zoomAt';
import type { View } from './view';

/** A hand-driven rAF: one queued frame per `advance`, at a clock we control.
 *  `useAnimator` seeds `lastRealNow` from `now()` at registration, so the first
 *  advance already carries the elapsed time. */
function makeClock() {
  let t = 0;
  let queue: Array<(ts: number) => void> = [];
  return {
    now: () => t,
    requestFrame: (cb: (ts: number) => void) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    advance(ms: number) {
      t += ms;
      const due = queue;
      queue = [];
      for (const cb of due) cb(t);
    },
  };
}

function makeChannel(initial: View) {
  let v = initial;
  const writes: View[] = [];
  const channel: ViewChannel = { get: () => v, set: (next) => { v = next; writes.push(next); } };
  return { channel, writes, current: () => v };
}

function mount(channel: ViewChannel, clock: ReturnType<typeof makeClock>, strict = false) {
  return renderHook(
    () => useViewAnimation(channel, useAnimator(clock)),
    strict ? { wrapper: StrictMode } : undefined,
  );
}

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('useViewAnimation', () => {
  it('writes the view every frame and lands exactly on the target', () => {
    const clock = makeClock();
    const { channel, writes, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    const target = zoomAt(HOME, { x: 100, y: 50 }, 4);
    act(() => { result.current.animate(target, { ms: 200, easing: linear }); });

    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(2, 10); // sqrt(1*4) at the halfway point
    expect(result.current.isAnimating()).toBe(true);

    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(4, 10);
    expect(current().x).toBeCloseTo(target.x, 10);
    expect(result.current.isAnimating()).toBe(false);
    expect(writes).toHaveLength(2);
  });

  it('fires onDone once, at the target', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock);
    const done = vi.fn();

    act(() => { result.current.animate({ x: 5, y: 5, scale: { x: 1, y: 1 } }, { ms: 100, onDone: done }); });
    act(() => { clock.advance(50); });
    expect(done).not.toHaveBeenCalled();
    act(() => { clock.advance(50); });
    expect(done).toHaveBeenCalledTimes(1);
    act(() => { clock.advance(50); });
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('starts a retarget from the live view, not from a captured start', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(current().x).toBeCloseTo(50, 10);

    act(() => { result.current.animate({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    // Halfway back from 50, not from 0 or 100.
    expect(current().x).toBeCloseTo(25, 10);
  });

  it('compounds a thunked retarget off the pending target', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate((base) => zoomAt(base, { x: 0, y: 0 }, 2), { ms: 200 }); });
    act(() => { clock.advance(20); });
    act(() => { result.current.animate((base) => zoomAt(base, { x: 0, y: 0 }, 2), { ms: 200 }); });

    // 2 x 2, off the pending target — not 2 x (wherever frame one landed).
    expect(result.current.target()!.scale.x).toBeCloseTo(4, 10);
  });

  it('stop() leaves the view where it is and clears the target', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    act(() => { result.current.stop(); });
    const held = current();

    act(() => { clock.advance(500); });
    expect(current()).toEqual(held);
    expect(current().x).toBeCloseTo(50, 10);
    expect(result.current.target()).toBeNull();
    expect(result.current.isAnimating()).toBe(false);
  });

  it('stopIfExternal() cancels an outside write but not the runner\'s own tick', () => {
    const clock = makeClock();
    let v: View = HOME;
    // Every write re-enters stopIfExternal, the way the `view` dep does.
    const api = { current: null as ReturnType<typeof useViewAnimation> | null };
    const channel: ViewChannel = {
      get: () => v,
      set: (next) => { api.current!.stopIfExternal(); v = next; },
    };
    const { result } = mount(channel, clock);
    api.current = result.current;

    act(() => { result.current.animate({ x: 100, y: 0, scale: { x: 1, y: 1 } }, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    expect(result.current.isAnimating()).toBe(true);
    expect(v.x).toBeCloseTo(50, 10);

    act(() => { channel.set({ x: 7, y: 7, scale: { x: 1, y: 1 } }); });
    expect(result.current.isAnimating()).toBe(false);
    act(() => { clock.advance(100); });
    expect(v).toEqual({ x: 7, y: 7, scale: { x: 1, y: 1 } });
  });

  it('animateToBounds fits and animates', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = mount(channel, clock);

    act(() => {
      result.current.animateToBounds(
        { x: 0, y: 0, width: 200, height: 100 },
        { width: 400, height: 200 },
        { padding: 0, ms: 100, easing: linear },
      );
    });
    act(() => { clock.advance(100); });
    expect(current().scale.x).toBeCloseTo(2, 10);
    expect(current().x).toBeCloseTo(0, 10);
    expect(current().y).toBeCloseTo(0, 10);
  });

  it('reports isAnimating correctly through a StrictMode remount', () => {
    const clock = makeClock();
    const { channel } = makeChannel(HOME);
    const { result } = mount(channel, clock, true);

    expect(result.current.isAnimating()).toBe(false);
    act(() => { result.current.animate({ x: 9, y: 0, scale: { x: 1, y: 1 } }, { ms: 100 }); });
    expect(result.current.isAnimating()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/core/viewport/useViewAnimation.test.ts
```

Expected: TypeScript/runtime failures on the old signature —
`TypeError: result.current.animate is not a function`, `Test Files  1 failed (1)`.

- [ ] **Step 3: Implement**

Replace `packages/core/src/core/viewport/useViewAnimation.ts` with:

```ts
import { useMemo, useRef } from 'react';
import { useAnimator } from '../../animation/useAnimator';
import { easeOutCubic } from '../../animation/easings';
import type { Animator, EasingFn, InterpolatorFactory } from '../../animation/types';
import { interpolateView } from './interpolateView';
import { fitViewToBounds } from './fitViewToBounds';
import type { Bounds, FitViewToBoundsOptions, ViewportDims } from './fitViewToBounds';
import type { View } from './view';

/** Cancel-key every camera animation registers under: one per animator. */
export const VIEW_ANIMATION_KEY = 'view';

const DEFAULT_MS = 250;

/** How the camera should move. */
export interface ViewAnimationOptions {
  /** Duration in ms. Default 250. */
  ms?: number;
  /** Easing curve. Default `easeOutCubic`. */
  easing?: EasingFn;
  /** Replace the kit's log-scale / fixed-anchor curve. */
  interpolator?: InterpolatorFactory<View>;
  /** Fires when the target is reached. Not called on cancel. */
  onDone?: () => void;
}

/** Options accepted by {@link ViewAnimationApi.animateToBounds}. */
export interface AnimateToBoundsOptions extends FitViewToBoundsOptions, ViewAnimationOptions {}

/** What the runner reads and writes. On `<SceneCanvas>` this is the same
 *  channel `view.set` uses, so a camera animation on an uncontrolled canvas
 *  costs no React render. */
export interface ViewChannel {
  get(): View;
  set(v: View): void;
}

/** The camera animation surface. One animation at a time. */
export interface ViewAnimationApi {
  /** Glide from the live view to `to`. A thunk receives the pending target when
   *  one is in flight, so successive discrete steps compound. */
  animate(to: View | ((base: View) => View), opts?: ViewAnimationOptions): void;
  /** `fitViewToBounds` composed with `animate`. */
  animateToBounds(bounds: Bounds, dims: ViewportDims, opts?: AnimateToBoundsOptions): void;
  /** Cancel. The view stays where it is — no jump to the target. */
  stop(): void;
  isAnimating(): boolean;
  /** Where the in-flight animation is heading, or null when none is. */
  target(): View | null;
  /** Cancel unless the write that prompted this came from the runner's own
   *  per-frame write. Feed it from every channel that can move the camera. */
  stopIfExternal(): void;
}

/**
 * Animate the viewport `View`. Runs on the kit's {@link Animator} — pass one to
 * share a canvas's animator, or omit it and the hook makes its own.
 *
 * Every animation registers under {@link VIEW_ANIMATION_KEY}, so starting one
 * cancels whatever was in flight, and each starts from the *live* view rather
 * than a captured value — an interrupted camera never jumps.
 */
export function useViewAnimation(view: ViewChannel, animator?: Animator): ViewAnimationApi {
  const own = useAnimator();
  const viewRef = useRef(view);
  viewRef.current = view;
  const animatorRef = useRef<Animator>(animator ?? own);
  animatorRef.current = animator ?? own;
  const targetRef = useRef<View | null>(null);
  const writingRef = useRef(false);

  return useMemo<ViewAnimationApi>(() => {
    const isAnimating = () => animatorRef.current.isActive(VIEW_ANIMATION_KEY);
    const target = () => (isAnimating() ? targetRef.current : null);
    const stop = () => {
      animatorRef.current.cancelKey(VIEW_ANIMATION_KEY);
      targetRef.current = null;
    };

    const animate: ViewAnimationApi['animate'] = (to, opts = {}) => {
      const from = viewRef.current.get();
      const resolved = typeof to === 'function' ? to(target() ?? from) : to;
      stop();
      targetRef.current = resolved;
      animatorRef.current.tween<View>({
        from,
        to: resolved,
        ms: opts.ms ?? DEFAULT_MS,
        easing: opts.easing ?? easeOutCubic,
        interpolator: opts.interpolator ?? interpolateView,
        cancelKey: VIEW_ANIMATION_KEY,
        onTick: (v) => {
          writingRef.current = true;
          try { viewRef.current.set(v); } finally { writingRef.current = false; }
        },
        onDone: () => {
          targetRef.current = null;
          opts.onDone?.();
        },
      });
    };

    return {
      animate,
      animateToBounds: (bounds, dims, opts = {}) => {
        const current = viewRef.current.get();
        const fitted = fitViewToBounds(bounds, dims, current, opts);
        if (fitted === current) return; // helper bailed (zero-area bounds/viewport)
        animate(fitted, opts);
      },
      stop,
      isAnimating,
      target,
      stopIfExternal: () => { if (!writingRef.current) stop(); },
    };
  }, []);
}
```

Then delete the dead hook:

```
git rm packages/core/src/core/viewport/useViewTween.ts packages/core/src/core/viewport/useViewTween.test.ts
```

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/core/viewport/useViewAnimation.test.ts
```

Expected: `Test Files  1 passed (1)`, `Tests  8 passed (8)`.

`npx tsc --noEmit` will still fail — `index.ts` re-exports `useViewTween`. Task 3 closes that.

- [ ] **Step 5: Mutation check**

1. `const from = targetRef.current ?? viewRef.current.get();` in `animate` → *starts a retarget
   from the live view* fails (lands at 0, not 25).
2. `const resolved = typeof to === 'function' ? to(from) : to;` → *compounds a thunked retarget*
   fails (2, not 4).
3. `stopIfExternal: () => stop()` (drop the guard) → *writes the view every frame* fails: the
   first tick cancels the animation.
4. Drop `writingRef.current = false` from the `finally` → *stopIfExternal cancels an outside
   write* fails, because the external write is then treated as internal.
5. `isAnimating: () => targetRef.current !== null` → *stop() leaves the view where it is* still
   passes, but *fires onDone once* is unaffected; use instead: `const isAnimating = () => true` →
   *writes the view every frame* fails on the final assertion.

- [ ] **Step 6: Commit**

```
git add -A packages/core/src/core/viewport
git commit -m "$(cat <<'EOF'
run camera animation on the kit's animator, and delete useViewTween

useViewTween carried its own rAF loop, its own lerp and a private easeOutCubic
while the animation package exported that easing plus forty others and an
animator that already handles cancel-keys, pausing and time-scaling. The tween
now registers there under one cancel-key, so a second animation displaces the
first through the animator's own mechanism.

useViewAnimation keeps the name and changes shape: it reads the live view each
time instead of taking a `from`, which is what makes an interrupted camera
resume from where it actually is rather than jumping back to a captured start.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix the barrel and the hooks doc

**Files:**
- Modify: `packages/core/src/index.ts:250-258`, `:1120`
- Modify: `docs/hooks.md:215`
- Test: `packages/core/src/index.barrel.test.ts` (append a describe block)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/index.barrel.test.ts`:

```ts
describe('camera animation barrel surface', () => {
  it('exports the camera runner and its interpolator, and no longer exports useViewTween', () => {
    const b = Barrel as Record<string, unknown>;
    expect(typeof b.useViewAnimation).toBe('function');
    expect(typeof b.interpolateView).toBe('function');
    expect(b.VIEW_ANIMATION_KEY).toBe('view');
    expect('useViewTween' in b).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/index.barrel.test.ts
```

Expected: `expected true to be false` on the `useViewTween` assertion (and a resolve error for the
deleted module, which the same edit fixes). `Test Files  1 failed (1)`.

- [ ] **Step 3: Implement**

In `packages/core/src/index.ts`, replace lines 250-258 with:

```ts
// ─── Viewport: wheel / velocity / decay / pinch / camera animation ──────────
export * from './core/viewport/wheelHandler';
export { clientToCanvas } from './core/viewport/clientToCanvas';
export { useVelocityTracker } from './core/viewport/useVelocityTracker';
export { useDecayLoop } from './core/viewport/useDecayLoop';
export type { DecayLoopConfig, PanBounds } from './core/viewport/useDecayLoop';
export { usePinchGesture } from './core/viewport/usePinchGesture';
export { interpolateView } from './core/viewport/interpolateView';
export { useViewAnimation, VIEW_ANIMATION_KEY } from './core/viewport/useViewAnimation';
```

and replace line 1120 with:

```ts
export type {
  AnimateToBoundsOptions,
  ViewAnimationApi,
  ViewAnimationOptions,
  ViewChannel,
} from './core/viewport/useViewAnimation';
```

In `docs/hooks.md`, replace line 215:

```md
- `useViewAnimation(view, animator?)` — animated view changes, on the kit animator
```

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/index.barrel.test.ts
npx tsc --noEmit
```

Expected: `Test Files  1 passed (1)`; `tsc` exits 0 with no output.

- [ ] **Step 5: Mutation check**

Re-add `export { useViewAnimation as useViewTween } from './core/viewport/useViewAnimation';` →
*exports the camera runner* fails on `'useViewTween' in b`.

- [ ] **Step 6: Commit**

```
git add packages/core/src/index.ts packages/core/src/index.barrel.test.ts docs/hooks.md
git commit -m "$(cat <<'EOF'
retire useViewTween from the barrel and name its replacement

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Publish the runner on the `view` dep

**Files:**
- Modify: `packages/core/src/interactions/actions/depSchema.ts:51-66`
- Modify: `packages/core/src/canvas/deps/view.ts`
- Test: `packages/core/src/canvas/deps/view.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/deps/view.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useViewDepSource } from './view';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function fakeRunner(): ViewAnimationApi {
  return {
    animate: vi.fn(),
    animateToBounds: vi.fn(),
    stop: vi.fn(),
    isAnimating: vi.fn(() => false),
    target: vi.fn(() => null),
    stopIfExternal: vi.fn(),
  };
}

describe('useViewDepSource', () => {
  it('omits the animation members when no runner is wired', () => {
    const ref = { current: HOME };
    const { result } = renderHook(() => useViewDepSource(ref, vi.fn()));
    expect(result.current.animate).toBeUndefined();
    expect(result.current.stopAnimation).toBeUndefined();
    expect(result.current.animationTarget).toBeUndefined();
  });

  it('cancels an in-flight animation on any set', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    const onViewChange = vi.fn();
    const { result } = renderHook(() => useViewDepSource(ref, onViewChange, undefined, undefined, runner));

    result.current.set({ x: 5, y: 5, scale: { x: 1, y: 1 } });

    expect(runner.stopIfExternal).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith({ x: 5, y: 5, scale: { x: 1, y: 1 } });
  });

  it('forwards animate, stopAnimation and animationTarget to the runner', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    (runner.target as ReturnType<typeof vi.fn>).mockReturnValue({ x: 1, y: 2, scale: { x: 3, y: 3 } });
    const { result } = renderHook(() => useViewDepSource(ref, vi.fn(), undefined, undefined, runner));

    result.current.animate!({ x: 9, y: 9, scale: { x: 2, y: 2 } }, { ms: 400 });
    expect(runner.animate).toHaveBeenCalledWith({ x: 9, y: 9, scale: { x: 2, y: 2 } }, { ms: 400 });

    result.current.stopAnimation!();
    expect(runner.stop).toHaveBeenCalledOnce();

    expect(result.current.animationTarget!()).toEqual({ x: 1, y: 2, scale: { x: 3, y: 3 } });
  });

  it('keeps one stable ViewApi identity across renders', () => {
    const ref = { current: HOME };
    const runner = fakeRunner();
    const { result, rerender } = renderHook(() => useViewDepSource(ref, vi.fn(), undefined, undefined, runner));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/canvas/deps/view.test.ts
```

Expected: `TypeError: result.current.animate is not a function`, `Test Files  1 failed (1)`.

- [ ] **Step 3: Implement**

In `packages/core/src/interactions/actions/depSchema.ts`, replace the `ViewApi` block
(`:51-66`) with:

```ts
/** Minimal view API the action layer consumes. */
export interface ViewApi {
  get(): View;
  set(v: View): void;
  /** Optional recenter callback. When wired, `viewportZoomAction`'s `reset`
   *  branch (Cmd-0) calls this instead of resetting to identity — letting
   *  consumers re-fit the page into the workspace. Return the target `View` to
   *  let the action animate there; return nothing to keep dispatching the view
   *  yourself. */
  recenter?(): View | void;
  /** Optional canvas-local host dimensions (CSS px). When wired,
   *  `viewportZoomAction`'s keyboard branches (Cmd+= / Cmd+-) anchor at the
   *  host center instead of the top-left origin. Null when the host isn't
   *  measurable (unmounted). */
  hostSize?(): { width: number; height: number } | null;
  /** Optional camera animation. `<SceneCanvas>` wires these three; a consumer
   *  publishing their own `view` dep need not, and actions fall back to `set`. */
  animate?(to: View, opts?: ViewAnimationOptions): void;
  stopAnimation?(): void;
  /** Where an in-flight camera animation is heading, or null. Compute the next
   *  discrete step from this so repeated presses compound. */
  animationTarget?(): View | null;
}
```

and add to that file's imports:

```ts
import type { ViewAnimationOptions } from 'core/viewport/useViewAnimation';
```

Replace `packages/core/src/canvas/deps/view.ts` with:

```ts
/**
 * `useViewDepSource` — builds a stable `ViewApi` that reads from
 * `currentViewRef`, writes via `onViewChange`, and (when a camera runner is
 * passed) exposes animation.
 *
 * NOTE: this hook does **not** itself call `useDepSource('view', ...)` because
 * `useStandardActions` already publishes the `view` dep when it is passed in
 * its options bag. Returning the `ViewApi` here lets the registrar hand the
 * same instance to `useStandardActions` (which then registers it) without
 * having to reconstruct it inline.
 */
import { useRef } from 'react';
import type React from 'react';
import type { ViewApi } from 'interactions/actions/depSchema';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';

export function useViewDepSource(
  currentViewRef: React.RefObject<View>,
  onViewChange: (v: View) => void,
  recenter?: () => View | void,
  hostSize?: () => { width: number; height: number } | null,
  animation?: ViewAnimationApi,
): ViewApi {
  const viewApiRef = useRef<ViewApi>({
    get: () => currentViewRef.current,
    set: (v: View) => onViewChange(v),
  });
  // Refresh closures every render so the latest onViewChange / recenter are captured.
  viewApiRef.current = {
    get: () => currentViewRef.current,
    // A camera animation writes through `onViewChange` directly, so anything
    // arriving here is someone else moving the camera and cancels it.
    set: (v: View) => { animation?.stopIfExternal(); onViewChange(v); },
    ...(recenter ? { recenter } : {}),
    ...(hostSize ? { hostSize } : {}),
    ...(animation
      ? {
          animate: (to: View, opts?: Parameters<ViewAnimationApi['animate']>[1]) => animation.animate(to, opts),
          stopAnimation: () => animation.stop(),
          animationTarget: () => animation.target(),
        }
      : {}),
  };
  return viewApiRef.current;
}
```

The identity test passes because `viewApiRef.current` is reassigned in place — the ref object is
returned, not a new literal. That was already true; the test pins it.

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/canvas/deps/view.test.ts
npx tsc --noEmit
```

Expected: `Test Files  1 passed (1)`, `Tests  4 passed (4)`; `tsc` exits 0.

- [ ] **Step 5: Mutation check**

1. Drop `animation?.stopIfExternal();` from `set` → *cancels an in-flight animation on any set*
   fails.
2. Spread the animation members unconditionally → *omits the animation members* fails.

- [ ] **Step 6: Commit**

```
git add packages/core/src/interactions/actions/depSchema.ts packages/core/src/canvas/deps/view.ts packages/core/src/canvas/deps/view.test.ts
git commit -m "$(cat <<'EOF'
give the view dep animate, stopAnimation and animationTarget

The dep's own note has said since it was written that it may grow animation
helpers. The three members are optional, like recenter and hostSize, so a
consumer publishing their own view dep is not forced to run a camera animator —
actions that want animation fall back to set.

A write through `set` cancels whatever the camera was doing, which is how a pan
or a wheel zoom interrupts a keyboard zoom without either knowing about the
other. recenter widens to return the target view, since a callback that sets the
view itself cannot be tweened.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Route the discrete zoom steps through the animation

**Files:**
- Modify: `packages/core/src/interactions/actions/defaults/viewportZoom.ts`
- Test: `packages/core/src/interactions/actions/defaults/viewportZoom.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/interactions/actions/defaults/viewportZoom.test.ts`:

```ts
// ---------------------------------------------------------------------------
// Animated discrete steps
// ---------------------------------------------------------------------------

function makeAnimatedView(initial: View = { x: 0, y: 0, scale: { x: 1, y: 1 } }) {
  let v = initial;
  let pending: View | null = null;
  const calls = { animate: [] as Array<{ to: View; opts: unknown }>, set: [] as View[] };
  const api: ViewApi = {
    get: () => v,
    set: (next) => { v = next; calls.set.push(next); },
    hostSize: () => ({ width: 400, height: 200 }),
    animate: (to, opts) => { pending = to; calls.animate.push({ to, opts }); },
    stopAnimation: () => { pending = null; },
    animationTarget: () => pending,
  };
  return { api, calls, current: () => v, setPending: (p: View | null) => { pending = p; } };
}

describe('makeViewportZoomAction with animate', () => {
  it('animates Cmd+= instead of setting the view', () => {
    const action = makeViewportZoomAction({ animate: { ms: 400 } });
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'in' });

    expect(calls.set).toEqual([]);
    expect(calls.animate).toHaveLength(1);
    // KEY_STEP 1.25, anchored at the host center (200, 100).
    expect(calls.animate[0].to.scale).toEqual({ x: 1.25, y: 1.25 });
    expect(calls.animate[0].opts).toMatchObject({ ms: 400 });
  });

  it('compounds successive steps off the pending target', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    const invoker = getImmediateInvoker(action);

    invoker.run({ view: api }, { kind: 'in' });
    invoker.run({ view: api }, { kind: 'in' });

    expect(calls.animate[1].to.scale.x).toBeCloseTo(1.25 * 1.25, 10);
  });

  it('never animates wheel zoom — the input already samples every frame', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'wheel', deltaY: -100, clientX: 0, clientY: 0 });

    expect(calls.animate).toEqual([]);
    expect(calls.set).toHaveLength(1);
  });

  it('sets rather than animates when the view dep has no animate', () => {
    const action = makeViewportZoomAction({ animate: true });
    const view = makeView();
    view.hostSize = () => ({ width: 400, height: 200 });
    getImmediateInvoker(action).run({ view }, { kind: 'in' });

    expect(view.get().scale).toEqual({ x: 1.25, y: 1.25 });
  });

  it('sets rather than animates when animate is off', () => {
    const action = makeViewportZoomAction();
    const { api, calls } = makeAnimatedView();
    getImmediateInvoker(action).run({ view: api }, { kind: 'in' });

    expect(calls.animate).toEqual([]);
    expect(calls.set).toHaveLength(1);
  });

  it('animates the reset branch to identity, honoring resetMs', () => {
    const action = makeViewportZoomAction({ animate: { ms: 200, resetMs: 500 } });
    const { api, calls } = makeAnimatedView({ x: 30, y: 40, scale: { x: 3, y: 3 } });
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(calls.animate).toHaveLength(1);
    expect(calls.animate[0].to).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    expect(calls.animate[0].opts).toMatchObject({ ms: 500 });
  });

  it('animates to the view a recenter callback returns', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView({ x: 30, y: 40, scale: { x: 3, y: 3 } });
    api.recenter = () => ({ x: -8, y: -8, scale: { x: 0.5, y: 0.5 } });
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(calls.animate[0].to).toEqual({ x: -8, y: -8, scale: { x: 0.5, y: 0.5 } });
  });

  it('leaves a void-returning recenter alone — it dispatched the view itself', () => {
    const action = makeViewportZoomAction({ animate: true });
    const { api, calls } = makeAnimatedView();
    const recenter = vi.fn(() => undefined);
    api.recenter = recenter;
    getImmediateInvoker(action).run({ view: api }, { kind: 'reset' });

    expect(recenter).toHaveBeenCalledOnce();
    expect(calls.animate).toEqual([]);
    expect(calls.set).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/interactions/actions/defaults/viewportZoom.test.ts
```

Expected: `Tests  8 failed | … passed` — the `animate` option is not in `ViewportZoomOptions` and
every discrete branch still calls `set`.

- [ ] **Step 3: Implement**

In `packages/core/src/interactions/actions/defaults/viewportZoom.ts`, add the import and option:

```ts
import type { View } from 'core/viewport/view';
import type { ViewAnimationOptions } from 'core/viewport/useViewAnimation';
```

```ts
/**
 * @experimental
 * Tuning for the animated form of the discrete zoom steps.
 */
export interface ViewportZoomAnimateOptions extends ViewAnimationOptions {
  /** Duration for the Cmd+0 reset branch. Defaults to `ms`. */
  resetMs?: number;
}
```

Add to `ViewportZoomOptions`:

```ts
  /**
   * Glide the discrete steps (Cmd+=, Cmd+-, Cmd+0) instead of jumping.
   * `true` uses the kit defaults; an object tunes them. Wheel and pinch never
   * animate — their input already samples every frame. Requires a `view` dep
   * that implements `animate`; without one this is ignored.
   */
  animate?: boolean | ViewportZoomAnimateOptions;
```

In `makeViewportZoomAction`, above the returned descriptor:

```ts
  const rawAnimate = opts.animate === true ? {} : (opts.animate || null);
  const tweenOpts: ViewAnimationOptions | null = rawAnimate
    ? { ms: rawAnimate.ms, easing: rawAnimate.easing, interpolator: rawAnimate.interpolator }
    : null;
  const resetMs = rawAnimate?.resetMs;
```

and replace the `run` body's switch with:

```ts
      run(deps, params) {
        const view = deps.view as ViewApi | undefined;
        if (!view) return;
        const current = view.get();
        const kind = params?.kind as string | undefined;

        const canAnimate = tweenOpts !== null && typeof view.animate === 'function';
        const stepTo = (target: View, ms?: number) => {
          if (!canAnimate) { view.set(target); return; }
          view.animate!(target, { ...tweenOpts!, ms: ms ?? tweenOpts!.ms });
        };
        // Successive presses compound off where the camera is heading, not off
        // whichever frame the tween happens to be on.
        const stepFrom = (): View => (canAnimate && view.animationTarget?.()) || current;

        switch (kind) {
          case 'wheel': {
            const deltaY = (params?.deltaY as number | undefined) ?? 0;
            const clientX = (params?.clientX as number | undefined) ?? 0;
            const clientY = (params?.clientY as number | undefined) ?? 0;
            const factor = Math.pow(WHEEL_STEP, -deltaY / 100);
            view.set(zoomAt(current, { x: clientX, y: clientY }, factor, clamp));
            break;
          }
          case 'in':
            stepTo(zoomAt(stepFrom(), keyAnchor(view), KEY_STEP, clamp));
            break;
          case 'out':
            stepTo(zoomAt(stepFrom(), keyAnchor(view), 1 / KEY_STEP, clamp));
            break;
          case 'reset': {
            // A recenter that returns its target can be animated; one that
            // returns nothing dispatched the view itself and is already done.
            const target = view.recenter
              ? view.recenter()
              : { x: 0, y: 0, scale: { x: 1, y: 1 } };
            if (target) stepTo(target, resetMs);
            break;
          }
          default:
            if (params === undefined) {
              view.set(zoomAt(current, { x: 0, y: 0 }, KEY_STEP, clamp));
            }
            break;
        }
      },
```

Update the descriptor's design-note header: the `'in'`/`'out'`/`'reset'` bullets now say they glide
when `animate` is configured and the `view` dep implements it.

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/interactions/actions/defaults/viewportZoom.test.ts
```

Expected: `Test Files  1 passed (1)`, all tests passing (the file's existing count plus 8).

- [ ] **Step 5: Mutation check**

1. `const stepFrom = () => current;` → *compounds successive steps* fails (1.25, not 1.5625).
2. `stepTo(...)` in the `wheel` branch → *never animates wheel zoom* fails.
3. `const canAnimate = tweenOpts !== null;` → *sets rather than animates when the view dep has no
   animate* fails with a TypeError.
4. `if (target !== undefined)` → `stepTo(target, resetMs)` unconditionally → *leaves a
   void-returning recenter alone* fails.
5. `view.animate!(target, tweenOpts!)` (drop the `ms` override) → *animates the reset branch …
   honoring resetMs* fails (200, not 500).

- [ ] **Step 6: Commit**

```
git add packages/core/src/interactions/actions/defaults/viewportZoom.ts packages/core/src/interactions/actions/defaults/viewportZoom.test.ts
git commit -m "$(cat <<'EOF'
glide the discrete zoom steps when the view dep can animate

Cmd+=, Cmd+- and Cmd+0 hand the action a target and nothing in between, which is
the whole condition for animating: wheel and pinch already deliver a sample per
frame, so tweening between them would only add latency for the next sample to
cancel. Those two keep calling set at every setting.

A repeated press computes its target from where the camera is heading rather
than from the frame the tween is on, so three fast presses land on 1.25 cubed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Let `viewport.recenter` return its target

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:613` (the `viewport.recenter` prop), `:2345-2350` (the registrar's `viewportRecenter`)
- Test: `packages/core/src/canvas/SceneCanvas.recenter.types.test.ts` (create)

Types only. Task 5 already covers the action's handling of both return shapes; this task carries
the widening out to the props a consumer actually writes. Its gate is `tsc`.

- [ ] **Step 1: Write the failing check**

Create `packages/core/src/canvas/SceneCanvas.recenter.types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { SceneCanvasProps } from './SceneCanvas';
import type { View } from 'core/viewport/view';

type Viewport = NonNullable<SceneCanvasProps<unknown, string, unknown>['viewport']>;

describe('viewport.recenter', () => {
  it('accepts a callback that returns the target view, and one that returns nothing', () => {
    const fitting: Viewport['recenter'] = () => ({ x: 1, y: 2, scale: { x: 3, y: 3 } } as View);
    const dispatching: Viewport['recenter'] = () => { /* sets the view itself */ };
    expect(fitting!()).toEqual({ x: 1, y: 2, scale: { x: 3, y: 3 } });
    expect(dispatching!()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.recenter.types.test.ts
npx tsc --noEmit
```

Expected: vitest passes (types are erased) but `tsc` fails with
`Type '() => View' is not assignable to type '() => void'` — **`tsc` is the gate for this task.**

- [ ] **Step 3: Implement**

In `packages/core/src/canvas/SceneCanvas.tsx`, replace the `recenter` declaration at `:613`:

```ts
      /** Callback invoked by Cmd-0 (`viewport.zoom` action's `reset` branch).
       *  When supplied, replaces the default reset-to-identity behavior —
       *  consumers typically refit the document page into the workspace via
       *  `fitViewToBounds`. Return the target `View` to let the kit animate
       *  there when `animatedZoom` is on; return nothing to dispatch it
       *  yourself, which is what a controlled canvas does. */
      recenter?: () => View | void;
```

and the registrar's forwarded prop at `:2345-2350`:

```ts
  /** Optional recenter callback. When supplied, wires through to the
   *  `view` dep so `viewport.zoom` reset (Cmd-0) calls it instead of
   *  snapping to identity. A returned `View` is a target the kit may
   *  animate to; `void` means the callback dispatched it itself. */
  viewportRecenter?: () => View | void;
```

- [ ] **Step 4: Run it and watch it pass**

```
npx tsc --noEmit
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.recenter.types.test.ts
```

Expected: `tsc` exits 0; `Test Files  1 passed (1)`, `Tests  1 passed (1)`.

- [ ] **Step 5: Mutation check**

Revert `recenter?: () => View | void;` to `() => void` → `tsc` fails on `fitting`.

- [ ] **Step 6: Commit**

```
git add packages/core/src/canvas/SceneCanvas.tsx packages/core/src/canvas/SceneCanvas.recenter.types.test.ts
git commit -m "$(cat <<'EOF'
let viewport.recenter return the view it wants

A callback that sets the view itself cannot be tweened — the kit never sees the
target. Returning it is how Cmd-0 opts into the same treatment as Cmd+=; a
callback that returns nothing keeps dispatching the view on its own.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Wire the camera into `SceneCanvas`

**Files:**
- Modify: `packages/core/src/canvas/canvasExtension.ts` (the `SceneCanvasApi` block)
- Modify: `packages/core/src/canvas/SceneCanvas.tsx`
- Modify: `packages/core/src/canvas/SceneCanvas/useViewportActions.ts`
- Test: `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx` (create — the wiring half; Task 8 adds the Mac keyboard half to the same file)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx`:

```tsx
/**
 * `viewport.animatedZoom` end to end.
 *
 * The keyboard cases live in the second describe and need the Mac platform
 * branch, so the user-agent stub below runs before the dispatcher module loads
 * (`IS_MAC` is a module-level constant, and jsdom's `navigator.platform` is the
 * empty string — not nullish — so the whole suite otherwise runs as non-Mac).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
    configurable: true,
  });
});

import { render, act, waitFor } from '@testing-library/react';
import { Profiler, createRef } from 'react';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import type { View } from 'core/viewport/view';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  // jsdom lays nothing out, so `hostSize` would measure 0x0 and `keyAnchor`
  // would fall back to the top-left origin — where a zoom is a fixed point on
  // both axes and every anchoring bug looks correct.
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { value: 400, configurable: true });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { value: 200, configurable: true });
});

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L, pose: { x: 0, y: 0, width: 10, height: 10 } as P });
  });
  return s;
}

// Hoisted: an inline literal is a fresh identity every render and would fire
// repaints (and re-registrations) on its own.
const NO_LAYERS = {};
const ANIMATED = { animatedZoom: { ms: 40 } } as const;

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

describe('SceneCanvas camera handle', () => {
  it('animateView glides to the target rather than arriving at once', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} />);
    await act(async () => { await frame(); });

    const target: View = { x: 100, y: 0, scale: { x: 4, y: 4 } };
    act(() => { ref.current!.animateView(target, { ms: 40 }); });

    // Nothing has ticked yet: a jump would already be at the target.
    expect(ref.current!.getView()).toEqual({ x: 0, y: 0, scale: { x: 1, y: 1 } });
    expect(ref.current!.isViewAnimating()).toBe(true);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(4, 6);
    expect(ref.current!.getView().x).toBeCloseTo(100, 6);
  });

  it('a setView during the glide cancels it and wins', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.animateView({ x: 500, y: 500, scale: { x: 8, y: 8 } }, { ms: 400 }); });
    await act(async () => { await frame(); await frame(); });

    const panned: View = { x: 7, y: 9, scale: { x: 1, y: 1 } };
    act(() => { ref.current!.setView(panned); });
    expect(ref.current!.isViewAnimating()).toBe(false);

    await act(async () => { await frame(); await frame(); });
    expect(ref.current!.getView()).toEqual(panned);
  });

  it('stopViewAnimation leaves the camera where it is', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.animateView({ x: 1000, y: 0, scale: { x: 1, y: 1 } }, { ms: 1000 }); });
    await act(async () => { await frame(); await frame(); });
    act(() => { ref.current!.stopViewAnimation(); });
    const held = ref.current!.getView();

    await act(async () => { await frame(); await frame(); });
    expect(ref.current!.getView()).toEqual(held);
    expect(held.x).not.toBe(1000);
  });

  it('glides without committing the canvas', async () => {
    const ref = createRef<SceneCanvasApi>();
    let commits = 0;
    render(
      <Profiler id="canvas" onRender={() => { commits++; }}>
        <SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={ANIMATED} />
      </Profiler>,
    );
    await act(async () => { await frame(); });

    const before = commits;
    act(() => { ref.current!.animateView({ x: 60, y: 0, scale: { x: 2, y: 2 } }, { ms: 40 }); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });

    expect(commits).toBe(before);
    expect(ref.current!.getView().x).toBeCloseTo(60, 6);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx
```

Expected: `TypeError: ref.current.animateView is not a function`, `Test Files  1 failed (1)`,
`Tests  4 failed (4)`.

- [ ] **Step 3: Implement**

In `packages/core/src/canvas/canvasExtension.ts`, add the import and the three camera members —
on `SceneCanvasApi`, not `CanvasExtensionApi`, because the bare primitive has no animator:

```ts
import type { ViewAnimationOptions } from '../core/viewport/useViewAnimation';
```

```ts
/**
 * The imperative ref handle for `<SceneCanvas>` — everything on
 * {@link CanvasExtensionApi} plus the surfaces only the scene-level canvas
 * can provide. `ingest` is always populated here (the optional declaration
 * on the base type exists for the bare-primitive handle).
 * @public
 */
export interface SceneCanvasApi extends CanvasExtensionApi {
  ingest(input: File[] | IngestItem[], point?: { x: number; y: number }): void;
  /**
   * Glide the camera to `to` rather than jumping there — a fit-to-selection, a
   * recenter, a scripted tour. A thunk receives the pending target when an
   * animation is already in flight, so steps compound. Any other view write
   * cancels it.
   */
  animateView(to: View | ((base: View) => View), opts?: ViewAnimationOptions): void;
  /** Cancel a camera animation. The view stays where it is. */
  stopViewAnimation(): void;
  isViewAnimating(): boolean;
}
```

In `packages/core/src/canvas/SceneCanvas.tsx`, add imports:

```ts
import { useAnimator } from '../animation/useAnimator';
import { useViewAnimation } from 'core/viewport/useViewAnimation';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
```

Immediately after `handleViewChange` / `notifyViewChange` (`:972` region):

```ts
  // The camera runs on its own animator, never the `animator` prop's: that prop
  // is the consumer's scene animator, and their `cancelAll()` or `pause()` must
  // not strand a zoom half-finished or freeze the camera.
  const cameraAnimator = useAnimator();
  const viewChannel = useMemo(
    () => ({ get: () => currentViewRef.current, set: handleViewChange }),
    [handleViewChange],
  );
  const viewAnimation = useViewAnimation(viewChannel, cameraAnimator);

  // Any view write the runner did not make cancels it. `subscribeView` covers
  // the uncontrolled path — hand tool, pinch, wheel, `handle.setView` — and the
  // `view` dep's `set` covers a controlled canvas, whose writes go out through
  // `onViewChange` and never reach a subscriber here.
  useEffect(() => {
    const api = canvasApiRef.current;
    if (!api) return;
    return api.subscribeView(() => viewAnimation.stopIfExternal());
  }, [canvasReady, viewAnimation]);

  // `animatedZoom` is the SceneCanvas-level spelling of the zoom action's
  // `animate` option, the way `pinchZoom` is of `makePinchZoomAction`'s clamp.
  const animatedZoom = viewport?.animatedZoom;
  const viewportZoomProp = viewport?.zoom ?? true;
  const resolvedViewportZoom = useMemo<boolean | ViewportZoomOptions>(() => {
    if (viewportZoomProp === false) return false;
    const base = typeof viewportZoomProp === 'object' ? viewportZoomProp : {};
    if (!animatedZoom) return base;
    return { ...base, animate: animatedZoom === true ? {} : animatedZoom };
  }, [viewportZoomProp, animatedZoom]);
```

Extend `mergedRef` (`:1835-1846`):

```ts
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      const extended: SceneCanvasApi | null = node
        ? {
            ...node,
            ingest: ingestImpl,
            animateView: viewAnimation.animate,
            stopViewAnimation: viewAnimation.stop,
            isViewAnimating: viewAnimation.isAnimating,
          }
        : null;
      canvasApiRef.current = extended;
      setCanvasReady(extended !== null);
      if (typeof ref === 'function') ref(extended);
      else if (ref) (ref as React.MutableRefObject<SceneCanvasApi | null>).current = extended;
    },
    [ref, ingestImpl, viewAnimation],
  );
```

Pass both down at the `<StandardActionsRegistrar>` call site (`:1949`):

```tsx
                viewportZoom={resolvedViewportZoom}
                viewportRecenter={viewport?.recenter}
                viewAnimation={viewAnimation}
```

Declare the new prop on `StandardActionsRegistrar` next to `viewportRecenter`:

```ts
  /** The canvas's camera runner, published on the `view` dep so
   *  `viewport.zoom`'s discrete branches can animate. */
  viewAnimation: ViewAnimationApi;
```

and destructure it, then thread it into the dep (`:2423`):

```ts
  const view = useViewDepSource(
    currentViewRef,
    onViewChange,
    viewportRecenter,
    () => {
      const el = canvasRef.current;
      return el ? { width: el.clientWidth, height: el.clientHeight } : null;
    },
    viewAnimation,
  );
```

Finally, update the `viewport` prop's `animatedZoom` declaration (`:601`):

```ts
      /** Glide Cmd+=/-/0 instead of jumping. `true` uses the kit defaults
       *  (250 ms, ease-out-cubic); an object tunes them. Wheel and pinch are
       *  unaffected — their input already samples every frame. */
      animatedZoom?: boolean | { ms?: number; resetMs?: number; easing?: EasingFn };
```

(and the bullet above it, which the `mac-pinch-zoom` branch left reading
"`animatedZoom` is declared but unimplemented").

In `packages/core/src/canvas/SceneCanvas/useViewportActions.ts`, extend the `zoomKey` comment:

```ts
  // Serialize the zoom config so the effect re-runs when its fields change
  // (object identity isn't stable across renders for inline literals).
  // JSON.stringify drops function-valued fields, so changing only
  // `animate.easing` does not re-register — pass a stable easing.
  const zoomKey = typeof zoom === 'object' ? JSON.stringify(zoom) : String(zoom);
```

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx
npx tsc --noEmit
npx vitest run --project=kit packages/core/src/canvas
```

Expected: the new file `Tests  4 passed (4)`; `tsc` exits 0; the canvas suite passes with no new
failures (it was 643 tests at the start of the frame-loop arc — read the number, don't assume it).

- [ ] **Step 5: Mutation check**

1. Replace `viewAnimation.animate` in `mergedRef` with `(to: View) => ref.current!.setView(to)` →
   *animateView glides* fails (arrives at once).
2. Delete the `subscribeView` effect → *a setView during the glide cancels it and wins* fails: the
   next tick overwrites the panned view.
3. `const cameraAnimator = animator ?? useAnimator();` — an illegal conditional hook, but the
   equivalent `const viewAnimation = useViewAnimation(viewChannel, animator)` → the camera stops
   when no `animator` prop is passed, so all four tests fail. Confirms the internal animator is
   load-bearing.
4. `return base;` unconditionally in `resolvedViewportZoom` → Task 8's keyboard tests fail (this
   task's four do not touch the action).
5. Remove `animateView` from `SceneCanvasApi` → `tsc` fails at the `mergedRef` literal and at the
   test's `ref.current!.animateView`.

- [ ] **Step 6: Commit**

```
git add packages/core/src/canvas
git commit -m "$(cat <<'EOF'
implement viewport.animatedZoom on the animation system

The prop has been declared, documented and read by nothing since May; Cmd+= was
a bare view.set. SceneCanvas now runs a camera animation on its own animator and
publishes it three ways: on the view dep, on the SceneCanvas ref handle, and
through animatedZoom, which resolves into the zoom action's animate option the
way pinchZoom resolves into its clamp.

The animator is SceneCanvas's own rather than the consumer's `animator` prop,
whose cancelAll would otherwise strand a zoom mid-flight. Each tick writes
through the same channel view.set uses, so an uncontrolled canvas pays no React
render for the glide; a controlled one pays what it already pays for any
per-frame view change.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Prove it at the keyboard, on the Mac branch

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx` (append a second describe)

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx`:

```tsx
const fireKey = (key: string, opts: { metaKey?: boolean } = {}) => {
  window.dispatchEvent(new KeyboardEvent('keydown', {
    bubbles: true, cancelable: true, key, metaKey: opts.metaKey ?? false,
  }));
};

const PLAIN = {} as const;

describe('viewport.animatedZoom at the keyboard (mac branch)', () => {
  it('Cmd+= jumps when animatedZoom is off', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={PLAIN} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(1.25, 10);
  });

  it('Cmd+= glides when animatedZoom is on, and lands on the same scale', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); });
    // The defining difference: unanimated, this is already 1.25.
    expect(ref.current!.getView().scale.x).toBe(1);
    expect(ref.current!.isViewAnimating()).toBe(true);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    expect(ref.current!.getView().scale.x).toBeCloseTo(1.25, 6);
  });

  it('three fast presses compound to 1.25 cubed', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { fireKey('=', { metaKey: true }); fireKey('=', { metaKey: true }); fireKey('=', { metaKey: true }); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });

    expect(ref.current!.getView().scale.x).toBeCloseTo(Math.pow(1.25, 3), 6);
  });

  it('Cmd+0 glides back to identity', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    act(() => { ref.current!.setView({ x: 40, y: 40, scale: { x: 3, y: 3 } }); });
    act(() => { fireKey('0', { metaKey: true }); });
    expect(ref.current!.getView().scale.x).toBe(3);

    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    const home = ref.current!.getView();
    expect(home.x).toBeCloseTo(0, 6);
    expect(home.y).toBeCloseTo(0, 6);
    expect(home.scale.x).toBeCloseTo(1, 6);
    expect(home.scale.y).toBeCloseTo(1, 6);
  });

  it('keeps the host center under the same world point for the whole glide', async () => {
    const ref = createRef<SceneCanvasApi>();
    render(<SceneCanvas ref={ref} scene={makeScene()} layers={NO_LAYERS} width={400} height={200} viewport={ANIMATED} />);
    await act(async () => { await frame(); });

    // The host center, from the clientWidth/clientHeight stubbed in `beforeAll`.
    // The origin would not do: a zoom anchored there leaves x and y untouched,
    // so this assertion would hold even against a linear translation lerp.
    const anchor = { x: 200, y: 100 };
    const worldAt = (v: View) => ({ x: anchor.x / v.scale.x + v.x, y: anchor.y / v.scale.y + v.y });
    const before = worldAt(ref.current!.getView());

    act(() => { fireKey('=', { metaKey: true }); });
    const samples: View[] = [];
    const stop = ref.current!.subscribeView((v) => { samples.push(v); });
    await waitFor(() => { expect(ref.current!.isViewAnimating()).toBe(false); });
    stop();

    expect(samples.length).toBeGreaterThanOrEqual(1);
    for (const s of samples) {
      expect(worldAt(s).x).toBeCloseTo(before.x, 8);
      expect(worldAt(s).y).toBeCloseTo(before.y, 8);
    }
  });
});
```

> `toBeGreaterThanOrEqual` appears once, guarding that the sample loop is not vacuous — it is not
> the assertion under test. Every claim about the camera is an exact or `toBeCloseTo` comparison.

- [ ] **Step 2: Run it and watch it fail**

```
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx
```

Expected: the four Task-7 tests pass; the five new ones fail — `expected 1.25 to be 1` on the
glide test, because `resolvedViewportZoom` has not reached the action yet if Task 7's last edit was
skipped. If Task 7 is complete they pass; in that case **verify by mutation before trusting them**
(Step 5), since a test that never failed is a test that has proved nothing.

- [ ] **Step 3: Implement**

No production change should be needed — Tasks 5 and 7 supply the behavior. If a test fails, fix the
production code, not the test. The two likely gaps:

- If the anchor test fails at t≈0, `hostSize` is measuring 0×0 — the
  `clientWidth`/`clientHeight` stubs in `beforeAll` are not landing, and `keyAnchor` fell back to
  the origin. Fix the stub, not the assertion: at the origin every anchoring bug looks correct.
- The `viewport={PLAIN}` case must still register the zoom action: `resolvedViewportZoom` returns
  `{}` for `viewport.zoom === true`, which is truthy, so `useViewportActions` registers it. If the
  jump test fails, that branch returned `false`.

- [ ] **Step 4: Run it and watch it pass**

```
npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx
```

Expected: `Test Files  1 passed (1)`, `Tests  9 passed (9)`.

- [ ] **Step 5: Mutation check**

1. Delete the `vi.hoisted` user-agent stub → every Cmd test fails (`mod` resolves to ctrlKey off
   Mac). **This is the check that the Mac branch is actually being exercised** — run it first.
2. In `viewportZoom.ts`, `const stepFrom = () => current;` → *three fast presses compound* fails.
3. In `interpolateView.ts`, lerp translation linearly in the zoom branch → *keeps the host center
   under the same world point* fails.
4. In `SceneCanvas.tsx`, `return base;` unconditionally in `resolvedViewportZoom` → *Cmd+= glides*
   fails (already 1.25).

- [ ] **Step 6: Commit**

```
git add packages/core/src/canvas/SceneCanvas.animatedZoom.test.tsx
git commit -m "$(cat <<'EOF'
cover animated keyboard zoom on the mac platform branch

The suite runs as non-Mac because jsdom reports an empty-string navigator
platform, so a Cmd binding is only reachable with a stubbed user agent installed
before the dispatcher module loads.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Changeset, and the demo claims

**Files:**
- Create: `.changeset/camera-animation.md`
- Modify: `apps/site/registry.ts:341-344`, `apps/site/demos/ViewportDemo.tsx:100`

- [ ] **Step 1: Check the claims before writing any**

```
git log --oneline -1 -- apps/site/registry.ts
grep -n "animated" apps/site/registry.ts apps/site/demos/ViewportDemo.tsx
```

The `mac-pinch-zoom` branch (`0dd35a19`) removed the animated-zoom claims. If the grep still shows
them, that branch is not in this history — say so and **verify each surviving claim against the
implementation** instead of restoring anything. Either way the rule is the same: a claim ships only
if this arc made it true.

What is now true: keyboard zoom (`⌘+=` / `⌘+-` / `⌘+0`) tweens with ease-out cubic; wheel and pinch
still jump per sample, by design; a pan or a wheel zoom cancels a glide in progress.
What is **not** true: nothing here animates inertia, and `animatedZoom` does not affect pinch.

- [ ] **Step 2: Write the claims**

In `apps/site/registry.ts`, the `viewport` entry:

```ts
    title: 'Viewport (inertia · pinch · animated zoom)',
    description: 'SceneCanvas viewport prop wires inertia pan, pinch zoom, and animated keyboard zoom in one place. Inertia uses a friction-decayed velocity loop after drag release; boundary clamping can stop or bounce the pan at configurable limits. animatedZoom tweens the discrete steps — Cmd+=, Cmd+-, Cmd+0 — through the kit animator, interpolating scale geometrically and holding the zoom anchor fixed; wheel and pinch keep jumping per sample, since their input already arrives every frame. Any pan or wheel zoom cancels a glide in progress.',
    hint: 'Drag fast and release to coast · ⌘+= / ⌘+- / ⌘+0 to zoom with easing · pan mid-zoom to interrupt it · toggle boundary to see stop vs bounce.',
```

(Leave the pinch sentence as `mac-pinch-zoom` left it — this arc did not change pinch.)

In `apps/site/demos/ViewportDemo.tsx:100`:

```tsx
        H / space = hand · drag fast + release = inertia · ⌘+= / ⌘+- / ⌘+0 = animated zoom (pan to interrupt)
```

- [ ] **Step 3: Write the changeset**

Create `.changeset/camera-animation.md`:

```md
---
'@weasel-js/core': patch
---

Camera animation: `viewport.animatedZoom` now does something

`animatedZoom` has been declared on `SceneCanvasProps.viewport` and read by
nothing; Cmd+=/-/0 was a bare `view.set`. It now routes the discrete zoom steps
through the kit's `Animator`. Wheel and pinch are unchanged and never animate —
their input already delivers a sample per frame.

Camera animation is a general surface, not a zoom flag. Three ways in, one
runner behind them:

- `useViewAnimation(view, animator?)` — `animate`, `animateToBounds`, `stop`,
  `isAnimating`, `target`.
- The `view` dep gains optional `animate` / `stopAnimation` / `animationTarget`,
  so any action can glide the camera.
- `SceneCanvasApi` gains `animateView` / `stopViewAnimation` /
  `isViewAnimating` for fit-to-selection, recenter, or a scripted tour.

Scale interpolates geometrically and translation is derived from the screen
point the two views agree on, so a zoom stays anchored instead of drifting and
each frame changes the view by the same ratio. One animation runs at a time; any
other view write cancels it, and a cancel leaves the camera where it is rather
than jumping to the target. On an uncontrolled canvas the whole animation costs
no React render.

**Breaking:** `useViewTween` is removed. `useViewAnimation` keeps its name and
changes signature — it takes a `{ get, set }` view channel plus an optional
`Animator`, and `animateTo(from, to, { duration, easing })` becomes
`animate(to, { ms, easing })`. The `from` argument is gone because the runner
reads the live view, which is what lets an interrupted camera resume from where
it actually is instead of snapping back to a captured start.

**Breaking:** `viewport.recenter` and `ViewApi.recenter` widen to
`() => View | void`. Returning the target view lets Cmd+0 animate there;
returning nothing keeps the existing behavior. `animatedZoom`'s config fields
are `ms` / `resetMs` rather than `duration` / `resetDuration`, matching the
animator's vocabulary.
```

Do **not** add a `bump-approved` marker. Every changeset in this repo is `patch`; `npm run
check:bumps` enforces it.

- [ ] **Step 4: Run the gates**

```
npm run check:bumps
npx tsc --noEmit
npm run lint
npm run test:unit
```

Expected: `check:bumps` reports OK with the patch changesets it finds; `tsc` exits 0; lint clean;
`test:unit` green with a total above the branch's starting count (7429 at the last handoff — read
the number the run prints, do not assert a remembered one).

- [ ] **Step 5: Mutation check**

Change the changeset's front matter to `minor` and re-run `npm run check:bumps` — it must fail.
Revert.

- [ ] **Step 6: Commit**

```
git add .changeset/camera-animation.md apps/site/registry.ts apps/site/demos/ViewportDemo.tsx
git commit -m "$(cat <<'EOF'
say what the viewport demo actually does now, and add the changeset

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Before merging

- **Drive `#viewport` by hand.** Cmd+=, Cmd+-, Cmd+0, then a pan mid-glide. The suite has been
  green through a blank canvas, uncompiled shaders and a doubled zoom factor; a demo sweep is not
  optional here.
- **Run the full gate**, not just `test:unit`:
  `npm run check:bumps && npm run typecheck && npm run lint && npm run test && npm run build`.
  `vitest` alone does not typecheck production code.
- **Check the visual baselines in CI**, not locally. A local pass does not imply CI passes for
  hairline strokes in this repo.
