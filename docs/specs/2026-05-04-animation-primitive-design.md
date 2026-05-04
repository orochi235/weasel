# Animation primitive design

**Date:** 2026-05-04
**Status:** Spec — ready for plan
**TODO entry it resolves:** "Animation as a primitive concept" under Tier 1 in `docs/TODO.md`.
**Driving consumers:** eric (raised-bed reflow tweens, plant entrance/exit), weasel-den (drag momentum on cards), generally any consumer that wants programmatic pose changes to slide instead of teleport.

## Problem

weasel has no story for time-based change. Every visible state mutation runs through a discrete pose op; nothing animates. Real apps want:

- **Tween-on-pose-change** — programmatic `setPose(id, newPose)` should slide instead of teleport (e.g., a child sliding to its new tile-grid slot when a sibling is added).
- **Entrance/exit** — fade-in on insert, fade-out on delete; lifecycle hooks the kit can wire automatically.
- **Gesture momentum/inertia** — flick-to-pan continues after pointer release; drop springs to its target.
- **Ambient loops** — pulsing handle, swaying decoration, blinking caret. Lower priority but the primitive should naturally support it.

Without a kit-level animator, every consumer reinvents rAF loops, easing math, and the "where is this object actually visible right now vs where the data says it is" reconciliation problem.

## Goal

A small, composable animation module under `src/animation/`. Three layers:

1. **Imperative animator core** (`useAnimator`) — per-Canvas rAF loop, three primitives: `tween` (duration + easing), `spring` (physics, retargets gracefully), `decay` (velocity-only, no destination — for momentum). Generic over any value `T` via interpolator/vector callbacks.
2. **Pose helpers** — `tweenPose` / `springPose` close over the adapter and a pose descriptor's `lerp` method so the common "animate id from current pose to new pose" call site is a one-liner.
3. **Adapter wrappers** (declarative) — `animateOnSetPose`, `animateLifecycle`, plus a `momentum` `MoveBehavior` plug-in. These wrap an existing adapter and turn its `setPose` / `insertObject` / `removeObject` calls into animations transparently.

The op log sees the **destination** pose (or insert/remove) once at animation start; in-flight frames bypass the op machinery and call `adapter.setPose` directly. Undo jumps to the pre-animation pose, history stays clean, and live state always reflects what's on screen.

## Architecture

### Frame loop ownership

Per-Canvas. `useAnimator(adapter)` owns the rAF loop. Loop runs while at least one animation is active; sleeps (no rAF scheduled) when none are. Multiple Canvases in one app cost N rAFs — fine, and each is idle by default.

The animator does **not** plug into `<Canvas>` directly. Instead it calls `adapter.setPose` (or `onTick`) per frame; the adapter's `setPose` already triggers React state changes, which already trigger Canvas repaint. No new render seam.

### Op-log interaction

The op log sees one op per animation, not per frame:

- **Tween / spring to a destination pose**: at animation start, the helper (or adapter wrapper) emits the standard transform op into history with `from = current pose`, `to = destination pose`, then begins tweening — but the tween writes through `adapter.setPose` directly each frame (skipping op generation). Undo from anywhere mid-animation cancels the animation and jumps to the pre-animation pose.
- **Generic value tween (`onTick` callback)**: no op at all; the consumer owns whatever side effect the callback performs.
- **Lifecycle insert/exit**: the insert op fires up front (so undo restores the original pose); the entrance animation modifies the visible pose to interpolate from the configured `enter.from`. For exit, the exit animation runs first, then the remove op fires at completion (so undo restores the object). User triggering undo mid-exit cancels the animation and the object snaps back to its real pose.

The kit assumes the consumer's `History.append` or equivalent is the only path that mutates history. The animator never calls into history directly.

### Animator API

```ts
interface UseAnimatorOptions {
  /** Optional clock injection for tests. Returns ms since some epoch. */
  now?: () => number;
}

interface Animator {
  tween<T>(opts: TweenOptions<T>): AnimationHandle;
  spring<T>(opts: SpringOptions<T>): AnimationHandle;
  decay<T>(opts: DecayOptions<T>): AnimationHandle;
  cancel(handle: AnimationHandle): void;
  cancelKey(key: string): void;
  cancelAll(): void;
  isActive(key?: string): boolean;
}

interface AnimationHandle {
  id: number;
  cancel(): void;
}

type EasingFn = (t: number) => number;
type Interpolate<T> = (from: T, to: T, t: number) => T;

interface TweenOptions<T> {
  from: T;
  to: T;
  ms: number;
  easing?: EasingFn;            // default: easeOut
  interpolate?: Interpolate<T>; // default: numeric for T=number; required for non-numeric
  onTick: (value: T) => void;
  onDone?: () => void;
  /** Any new animation passed the same cancelKey cancels the prior one
   *  in flight. Default: undefined (no cancel grouping). */
  cancelKey?: string;
}

interface SpringPreset {
  stiffness: number;
  damping: number;
  mass: number;
}

interface SpringOptions<T> {
  from: T;
  to: T;
  velocity?: T;                  // initial velocity, default zero (T-shape-aware)
  preset?: 'gentle' | 'wobbly' | 'stiff' | 'slow';
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolate?: Interpolate<T>;
  /** T-shape-aware vector helpers — required for non-numeric T. */
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
  /** Velocity magnitude below which the spring is considered settled. */
  restThreshold?: number;        // default 0.01
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
}

interface DecayOptions<T> {
  from: T;
  velocity: T;
  /** Per-second velocity multiplier, 0..1 exclusive. Default 0.95. */
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

export function useAnimator(opts?: UseAnimatorOptions): Animator;
```

**Built-in easings** in `src/animation/easings.ts`:

```ts
export const linear: EasingFn = (t) => t;
export const easeIn: EasingFn = (t) => t * t;
export const easeOut: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut: EasingFn = (t) => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
```

**Spring presets** (rspring/framer-motion-style values):

```ts
export const SPRING_PRESETS: Record<string, SpringPreset> = {
  gentle: { stiffness: 120, damping: 14, mass: 1 },
  wobbly: { stiffness: 180, damping: 12, mass: 1 },
  stiff:  { stiffness: 210, damping: 20, mass: 1 },
  slow:   { stiffness:  80, damping: 20, mass: 1 },
};
```

### Pose helpers

```ts
interface TweenPoseOptions<TPose> {
  id: string;
  to: TPose;
  ms: number;
  easing?: EasingFn;
  /** Pose descriptor with a `lerp(from, to, t) => TPose` method. Defaults
   *  to a rect-shape lerp (interpolates x/y/width/height linearly). */
  geometry?: PoseDescriptor<TPose>;
  /** When true (default), emit a transform op into history before starting
   *  the tween so undo restores the pre-animation pose. */
  recordOp?: boolean;
  onDone?: () => void;
}

export function tweenPose<TObject extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TObject, TPose>,
  opts: TweenPoseOptions<TPose>,
): AnimationHandle;

export function springPose<TObject extends { id: string }, TPose>(
  animator: Animator,
  adapter: SceneAdapter<TObject, TPose>,
  opts: SpringPoseOptions<TPose>,  // mirrors TweenPoseOptions but with spring fields
): AnimationHandle;
```

`PoseDescriptor<TPose>` gains an optional `lerp?: (a: TPose, b: TPose, t: number) => TPose` method. The default rect-pose descriptor and `pathPoseDescriptor` both implement it; consumers with custom poses pass their own.

`tweenPose` sets `cancelKey: 'pose:' + id` so a second `tweenPose(animator, adapter, { id, ... })` for the same id cancels the prior tween — the new tween starts from the **current visible pose** (live, mid-flight) and animates to the new destination. Predictable cancel-and-redirect.

### Adapter wrappers (declarative layer)

Three wrappers, each takes an existing adapter and returns a new one with augmented behavior. Wrappers compose (you can stack them).

#### `animateOnSetPose(adapter, animator, opts)`

```ts
interface AnimateOnSetPoseOptions<TPose> {
  /** Default: 200ms tween with easeOut. */
  ms?: number;
  easing?: EasingFn;
  /** Use a spring instead of a duration tween. Mutually exclusive with ms/easing. */
  spring?: { preset?: 'gentle' | 'wobbly' | 'stiff' | 'slow'; stiffness?: number; damping?: number; mass?: number };
  geometry?: PoseDescriptor<TPose>;
  /** Predicate: skip animation for some setPose calls (return false to skip).
   *  Use case: skip animation during an active drag so the gesture's per-pointer
   *  setPose calls don't get tweened — only animate "real" programmatic moves. */
  shouldAnimate?: (id: string, from: TPose, to: TPose) => boolean;
}

export function animateOnSetPose<TObject extends { id: string }, TPose>(
  adapter: SceneAdapter<TObject, TPose>,
  animator: Animator,
  opts?: AnimateOnSetPoseOptions<TPose>,
): SceneAdapter<TObject, TPose>;
```

Wraps the adapter's `setPose`. On call, instead of writing the pose immediately, kicks off `tweenPose` (or `springPose`). The op-log entry is recorded once at animation start (transform from old → new), and the visible pose interpolates.

For drag avoidance: callers pass `shouldAnimate: (id) => !someActiveDragSet.has(id)`. The kit ships a convenience: `animateOnSetPose(adapter, animator, { skipDuringGesture: true })` which auto-skips when an active gesture's `draggedIds` includes the id (reads via a kit-internal "is this id in flight" channel — added with this work).

#### `animateLifecycle(adapter, animator, opts)`

```ts
interface LifecycleAnimation<TPose> {
  /** Pose to animate the new object FROM at insert. */
  enterFrom?: (final: TPose) => TPose;
  /** Pose to animate the existing object TO at remove. */
  exitTo?: (current: TPose) => TPose;
  ms?: number;
  easing?: EasingFn;
  geometry?: PoseDescriptor<TPose>;
}

export function animateLifecycle<TObject extends { id: string }, TPose>(
  adapter: SceneAdapter<TObject, TPose>,
  animator: Animator,
  opts: LifecycleAnimation<TPose>,
): SceneAdapter<TObject, TPose>;
```

Wraps `insertObject` / `removeObject`. On insert: applies the object as normal (op fires, scene state correct), then immediately calls `setPose(id, enterFrom(finalPose))` and kicks a tween from there to `finalPose`. On remove: kicks the exit tween first (tweens current → `exitTo(current)`), and only calls the underlying `removeObject` in `onDone`. If undo fires mid-exit, the wrapper cancels the exit animation and the object is back where it was. (Mid-enter undo cancels the tween and removes the object — same as if the user had hit undo right after insert.)

Common use: `animateLifecycle(adapter, animator, { enterFrom: (p) => ({ ...p, opacity: 0 }), exitTo: (p) => ({ ...p, opacity: 0 }), ms: 250 })` — requires the consumer's pose to carry an opacity field, or use `geometry` with a custom `lerp` that knows how to interpolate alpha. Scale-from-zero variant: `enterFrom: (p) => ({ ...p, width: 0, height: 0 })`.

#### `momentum({ friction, threshold })` — a `MoveBehavior`

```ts
interface MomentumOptions {
  friction?: number;     // default 0.92
  threshold?: number;    // default 0.5 px/frame
  /** Sample window in ms for velocity computation. Default 80ms. */
  velocitySampleMs?: number;
}

export function momentum<TPose>(opts?: MomentumOptions): MoveBehavior<TPose>;
```

Records the last `velocitySampleMs` of pointer positions in the gesture context's scratch space. On `onEnd`: computes the average pointer velocity over the sample window. If above `threshold`, returns `null` (suppress the default commit) and instead fires `animator.decay(...)` with the release velocity. The decay's `onTick` translates the dragged pose by the per-frame delta and calls `setPose`. When decay finishes, the final pose is committed via a single `transform` op for history.

The behavior takes the animator as an argument: `momentum({ friction: 0.93, animator })` — passed in by the consumer at the call site (similar to how `gridSnapStrategy(spacing)` is constructed).

### Cancellation semantics

- Any new animation with the same `cancelKey` cancels the prior. New animation starts from the current live value.
- `animator.cancel(handle)` — cancels a specific animation. Pose stays at current value (no jump).
- `animator.cancelKey(key)` — cancels by cancelKey.
- `animator.cancelAll()` — cancels everything (call from a destructor or "reset scene" path).
- An active gesture on an animating id (e.g., user grabs a moving object) automatically cancels via `cancelKey: 'pose:' + id` when `useMove`/`useResize` calls `setPose` during the drag — but only if the adapter is wrapped with `animateOnSetPose` AND `shouldAnimate` returns false during gestures (the convenience `skipDuringGesture: true` handles this). Without that wrapper, gesture writes through directly and the animation continues to fight it — visible flicker. Documented as a sharp edge.

### Scratch / state location

The animator owns one ref-stable `Map<number, ActiveAnimation>` (id → animation record). No React state — animation tick triggers updates via `adapter.setPose` only. The animator returns a referentially-stable controller across renders (same pattern as `useMove`).

`ActiveAnimation` carries the animation record, the `onTick` callback, the start time, and (for spring/decay) the current value + velocity carried frame-to-frame.

### Composition example

```ts
function MyScene() {
  const [scene, setScene] = useState(INITIAL);
  const baseAdapter = useMemo(() => makeAdapter(scene, setScene), [scene]);
  const animator = useAnimator();

  // Wrap the adapter with two layers: lifecycle (enter/exit fade) and
  // animate-on-set-pose (tween programmatic pose changes). Order matters:
  // outermost wrapper sees the call first.
  const adapter = useMemo(() => {
    return animateLifecycle(
      animateOnSetPose(baseAdapter, animator, { ms: 200, skipDuringGesture: true }),
      animator,
      {
        enterFrom: (p) => ({ ...p, width: 0, height: 0 }),
        exitTo:    (p) => ({ ...p, width: 0, height: 0 }),
        ms: 250,
        easing: easeOut,
      },
    );
  }, [baseAdapter, animator]);

  const select = useSelectTool(adapter, {
    move: { behaviors: [momentum({ friction: 0.93, animator })] },
  });
  const tools = useTools({ active: select });

  return <Canvas adapter={adapter} tools={tools} />;
}
```

## Files to create / modify

**Create:**

- `src/animation/types.ts` — `Animator`, `AnimationHandle`, `EasingFn`, `Interpolate<T>`, `TweenOptions<T>`, `SpringOptions<T>`, `DecayOptions<T>`, `SpringPreset`.
- `src/animation/easings.ts` — `linear`, `easeIn`, `easeOut`, `easeInOut`, `SPRING_PRESETS`.
- `src/animation/useAnimator.ts` — the rAF-driven core. ~200 LOC.
- `src/animation/poseHelpers.ts` — `tweenPose`, `springPose`. Default rect-pose lerp.
- `src/animation/wrappers/animateOnSetPose.ts`
- `src/animation/wrappers/animateLifecycle.ts`
- `src/animation/wrappers/index.ts` — barrel.
- `src/animation/behaviors/momentum.ts` — `MoveBehavior`.
- `src/animation/index.ts` — top-level barrel.
- `demo/demos/AnimationDemo.tsx` — three buttons / interactions: "Tween to point" (click somewhere, an object slides there), "Spring to point" (same with spring), "Flick" (drag-and-release a card; momentum decays).
- `demo/demos/__tests__/animationDemo.integration.test.tsx`.
- Tests for each new module (mirrored layout under `src/animation/`).

**Modify:**

- `src/core/poseDescriptor.ts` (or wherever `PoseDescriptor` lives) — add optional `lerp?(a, b, t): TPose` method. Implement on the rect descriptor and `pathPoseDescriptor`.
- `src/index.ts` — re-export `./animation`.
- `docs/TODO.md` — remove the "Animation as a primitive concept" entry from Tier 1; append deferred items (see below).

**Tests:**

- `src/animation/useAnimator.test.tsx` — clock injection (`now` option). Each animation type ticked frame-by-frame, value at known timestamps verified. Cancel semantics. Multi-animation. rAF starts/stops per active count.
- `src/animation/easings.test.ts` — boundary values (`f(0) === 0`, `f(1) === 1`), shape sanity.
- `src/animation/poseHelpers.test.ts` — `tweenPose` calls `setPose` at expected times; cancelKey collision cancels prior; `recordOp: false` skips the op emit.
- `src/animation/wrappers/animateOnSetPose.test.tsx` — wrapped adapter's `setPose` triggers a tween, not an immediate write. `shouldAnimate` predicate respected. Underlying op is recorded once.
- `src/animation/wrappers/animateLifecycle.test.tsx` — insert tweens from `enterFrom` to final; remove tweens to `exitTo` before underlying `removeObject` fires; mid-animation undo cancels.
- `src/animation/behaviors/momentum.test.tsx` — pointer-move history captured; on end, decay fires with computed velocity; below-threshold flicks skip decay.
- `demo/demos/__tests__/animationDemo.integration.test.tsx` — drives the three demo paths.

## Tests required

(Covered above.) The animator tests use `now` injection so every animation can be ticked deterministically — no `vi.useFakeTimers()` or rAF polyfill required. Wrapper tests use a dummy adapter and assert call sequencing through spies.

## Deferred / out of scope

(Track in `docs/TODO.md` per project policy on deferrals.)

- **Ambient / looping animations.** Use case (b) from brainstorming. The primitive supports it (a tween with `onDone` that retriggers itself; or a custom animation that ignores `to`/`ms` and reads time). No first-class API in v1; ship `loop({...})` if a real consumer wants the convenience.
- **Spring "no destination" mode.** Currently `spring` requires `to`; `decay` exists for the no-target case. Some libraries unify these — defer until the seam pinches.
- **Animation events / observability.** No global "animation started" / "animation ended" event stream. Consumers subscribe via per-animation `onDone`. Add a `subscribe` API if a debug overlay or analytics consumer wants it.
- **Synchronized animations / staggers.** "Animate these N objects with a 50ms stagger" as a one-liner. Easy to build on the primitive; defer the convenience helper.
- **Animation-aware undo.** Today, mid-animation undo cancels the animation and jumps to pre-animation state. A "rewind the animation" undo (run it backwards) is interesting but not requested. Defer.
- **GPU/web-animations bridge.** `useAnimator` ticks in JS and writes through `setPose`. For very large concurrent counts (100+), a `Web Animations API` bridge could offload to compositor. Defer until the use case appears.
- **Scroll-driven / pointer-driven progress.** Animation progress driven by an external value (scroll position) rather than time. Different model; spec separately when needed.
- **Easing function library.** v1 ships four named easings + custom `(t) => t`. A wider library (`easeOutBack`, `easeInElastic`, etc.) is a one-file addition when wanted.
- **Animator pause / resume / time-scale.** No global pause or 0.5x-time. Useful for debugging; defer.
- **Layout-strategy reflow integration.** The container-layout-strategies spec defers "Animated reflow transitions" — that becomes a thin wrapper or a consumer-side recipe (`animateOnSetPose` over the layout-driven adapter already gives most of it). No dedicated v1 wiring; the use case is supported by composition.

## Migration notes

- Zero breaking changes. Every new export is additive. Existing adapters and consumers ignore the animation module entirely.
- Adoption is per-feature: wrap your adapter in `animateOnSetPose` to get tween-on-pose-change everywhere; add a `momentum` behavior to your move-tool config to get flicks; add `animateLifecycle` for fades. None require the others.
- The op-log policy ("one op at animation start, in-flight frames bypass") is invisible to consumers — they see the same op stream they always did, just smoother visuals between commits.
- Sharp edge: an active gesture on an animating id needs `animateOnSetPose({ skipDuringGesture: true })` (or equivalent `shouldAnimate` predicate) or the gesture's setPose calls fight the in-flight tween. Documented in the wrapper's JSDoc and the demo.
