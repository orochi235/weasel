# Animator ergonomics: virtual clock, unified physics, loop, stagger

**Date:** 2026-05-16
**Status:** Spec — ready for plan
**TODO entries it resolves:** From `docs/TODO.md` "Deferred from animation primitive (2026-05-04)" — `loop({...})` ambient/looping sugar; Spring "no destination" mode (unify `spring`/`decay`); synchronized animations / staggers; animator pause / resume / time-scale.
**Driver:** weasel is exploratory — we want the animation primitive to be expressive enough to build interesting motion without consumers having to drop down to raw rAF.

## Problem

The animation primitive shipped 2026-05-12 covers the common cases (tween-on-set-pose, lifecycle, momentum) but four ergonomic gaps surface as soon as anyone tries to build non-trivial motion:

1. **No pause / resume / time-scale.** Debugging a misbehaving animation means cancelling and re-firing. There's no "freeze the scene," no slow-motion knob, no per-animation pause.
2. **Spring and decay are separate primitives** that can't hand off mid-flight. The natural "flick the panel (decay), then snap to grid (spring)" interaction loses velocity at the handoff because the decay must be cancelled before a fresh spring starts.
3. **No `loop`.** Pulsing handles, breathing carets, swaying decorations all want a re-firing tween. Today consumers wire `onDone` callbacks to start the next iteration themselves, including reversing from/to for ping-pong.
4. **No stagger.** "Fade in N items with X ms between each" is a hand-rolled `setTimeout` loop per consumer.

Each gap is small in isolation; together they make the primitive feel like a low-level building block instead of an expressive motion system.

## Goal

One coherent revision of `src/animation/` that:

- Puts a **virtual clock** under every animation, so pause/resume/timeScale work uniformly at three scopes: animator-global, by `cancelKey`, and per-handle.
- **Unifies `spring` and `decay`** into `animator.physics({ from, to?, velocity?, ... })`. `spring` and `decay` become thin sugar. `setTarget(handle, to)` retargets in-flight, including decay→spring and spring→decay handoffs with velocity preserved.
- Adds **`animator.loop(factory, { count })`** as a composition primitive plus `tweenLoop({ direction })` sugar for the breathing/ping-pong case.
- Adds **`animator.stagger(items, ms, factory)`** as a primitive plus a fluent builder (`animator.stagger(ids, 30).springPose(...)`) for the common case where the only per-item variation is the target value.

Out of scope (still deferred): animation events / observability, scroll-driven progress, layout-strategy reflow integration, animation-aware undo, GPU bridge.

## Architecture

### Virtual clock substrate

Today each `ActiveAnimation`'s `tick(nowMs)` receives the real `performance.now()` timestamp from rAF and computes its own `elapsed` (tween) or `dt` (spring/decay) against that. To support pause and time-scale, the animator interposes a per-animation virtual clock:

```ts
interface ActiveAnimation {
  // ... existing fields ...
  paused: boolean;
  timeScale: number;
  virtualNow: number;    // monotonically advances, respects pause+timeScale
  lastRealNow: number | null;
}
```

The outer `tickAll` loop, before calling each `anim.tick`, advances `virtualNow`:

```ts
const realDt = anim.lastRealNow == null ? 0 : (realNow - anim.lastRealNow);
const effectiveScale = globalTimeScale * (anim.paused ? 0 : anim.timeScale);
anim.virtualNow += realDt * effectiveScale;
anim.lastRealNow = realNow;
anim.tick(anim.virtualNow);
```

Tween/spring/physics tick bodies stay the same — they still see a monotonic time arg, and they don't know or care whether it tracks wall time. A paused animation is still in the active set (so the rAF loop keeps running) but its `virtualNow` doesn't advance, so it renders frozen at its last value.

A global pause additionally lets us stop the rAF loop entirely (no animation can advance), but that's an optimization on top of the substrate, not part of the contract.

### Unified physics primitive

`spring` and `decay` collapse into `animator.physics({ from, to?, velocity?, ... })`. The integration step is the spring's semi-implicit Euler:

```
a = (-k(x - to) - c*v) / m
```

When `to == null`, set `k = 0` → only the damping force acts → `v(t) = v0 · exp(-c/m · t)`. That's mathematically equivalent to today's `decay` with `friction = exp(-damping/mass)` per second. So one integrator covers both.

```ts
interface PhysicsOptions<T> {
  from: T;
  to?: T | null;              // omit or null for pure decay
  velocity?: T;               // initial velocity; defaults to 0 (or to (to - from)*0 for spring)
  stiffness?: number;         // default 170; ignored when to == null
  damping?: number;           // default 26
  mass?: number;              // default 1
  restThreshold?: number;     // default 0.01
  onTick: (value: T) => void;
  onDone?: () => void;
  cancelKey?: string;
  // Vector ops, required for non-numeric T:
  add?: (a: T, b: T) => T;
  subtract?: (a: T, b: T) => T;
  scale?: (v: T, k: number) => T;
  magnitude?: (v: T) => number;
}

interface PhysicsHandle extends AnimationHandle {
  setTarget(to: T | null): void;   // null switches to decay; non-null switches to spring
  setVelocity(v: T): void;
}
```

`setTarget` is the retargeting primitive. Mid-flight, the integrator's `to` and `k` flip on the next tick; velocity carries through. This is the API that makes flick→snap work as a single continuous motion.

**Sugar wrappers** preserve today's ergonomics and call sites:

```ts
animator.spring(o)  // → animator.physics({ ...o, to: o.to /* required */ })
animator.decay(o)   // → animator.physics({
                    //     from: o.from,
                    //     velocity: o.velocity,
                    //     to: null,
                    //     mass: 1,
                    //     stiffness: 0,
                    //     // friction-per-second → damping coefficient (m=1):
                    //     damping: -Math.log(o.friction),
                    //     ...
                    //   })
```

`decay`'s existing call sites (`momentum`, `useHandTool` inertia) keep working unchanged. They get retargeting "for free" if they later want it — the underlying handle is a `PhysicsHandle`.

### `loop`

```ts
animator.loop<T>(
  factory: (iteration: number) => AnimationHandle,
  opts?: { count?: number; cancelKey?: string }
): AnimationHandle;
```

The loop tracks a single "current child" handle. On the child's `onDone`, it increments the iteration counter; if `count` is set and exhausted, the loop completes (`onDone` fires). Otherwise it calls `factory(iteration)` again and stores the new child. Cancelling the loop handle cancels the current child and prevents future iterations. Pausing the loop pauses the current child (the pause cascades).

**Sugar** for the common breathing case:

```ts
animator.tweenLoop({
  from: T,
  to: T,
  ms: number,
  easing?,
  direction?: 'restart' | 'reverse' | 'alternate',  // default 'restart'
  count?: number,
  onTick, onDone, interpolate, cancelKey
}): AnimationHandle;
```

`direction` shapes the factory:
- `'restart'` — every iteration plays `from → to`
- `'reverse'` — every iteration plays `to → from` (i.e., reversed once and then static)
- `'alternate'` — odd iterations play `to → from`, even play `from → to`

### `stagger`

Primitive form:

```ts
animator.stagger<TItem>(
  items: TItem[],
  delay: number | ((index: number) => number),
  factory: (item: TItem, index: number) => AnimationHandle
): AnimationHandle;
```

`delay` is either a constant ms-between-starts or a function of the index (so the consumer can do non-linear stagger curves). The composite handle:

- On cancel: cancels all in-flight children and clears all pending timers.
- On pause: pauses all in-flight children, freezes the scheduled-but-not-yet-started timers (recorded as remaining-delay; restored on resume).
- `onDone`: fires when the last child completes.

**Fluent builder** for the common case:

```ts
interface StaggerBuilder<TItem> {
  each(factory: (item: TItem, i: number) => AnimationHandle): AnimationHandle;

  // Each builder method accepts the underlying primitive's options, with
  // per-item-varying fields typed as `T | ((item: TItem, i: number) => T)`.
  tween<T>(opts: StaggerTweenOptions<T, TItem>): AnimationHandle;
  spring<T>(opts: StaggerSpringOptions<T, TItem>): AnimationHandle;
  physics<T>(opts: StaggerPhysicsOptions<T, TItem>): AnimationHandle;
  tweenPose(adapter, posesOrFn, opts?): AnimationHandle;
  springPose(adapter, posesOrFn, opts?): AnimationHandle;
}

animator.stagger(items, delay): StaggerBuilder<TItem>;
animator.stagger(items, delay, factory): AnimationHandle;  // two-arg primitive
```

Per-item-varying fields use the `T | (item, i) => T` pattern. Example:

```ts
animator.stagger(ids, 30).springPose(adapter, (id, i) => ({
  x: i * 100, y: 0, rotation: 0,
}));
```

The builder is a thin shell that constructs a factory closure and delegates to the primitive. No new runtime concept.

## Public API surface

New on `Animator`:

```ts
interface Animator {
  // existing
  tween, spring, decay, cancel, cancelKey, cancelAll, isActive, isTicking;

  // new
  physics<T>(o: PhysicsOptions<T>): PhysicsHandle<T>;
  loop(factory, opts?): AnimationHandle;
  tweenLoop(opts): AnimationHandle;
  stagger<TItem>(items, delay): StaggerBuilder<TItem>;
  stagger<TItem>(items, delay, factory): AnimationHandle;

  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
  isPaused(): boolean;

  pauseKey(key: string): void;
  resumeKey(key: string): void;
  setTimeScaleByKey(key: string, scale: number): void;
}
```

New on every `AnimationHandle`:

```ts
interface AnimationHandle {
  id: number;
  cancel(): void;
  // new:
  pause(): void;
  resume(): void;
  setTimeScale(scale: number): void;
  isPaused(): boolean;
}
```

New on `PhysicsHandle` only:

```ts
interface PhysicsHandle<T> extends AnimationHandle {
  setTarget(to: T | null): void;
  setVelocity(v: T): void;
}
```

## Op-log interaction

Unchanged. The op-log discipline from the original primitive holds: one op per logical animation, in-flight frames bypass op generation. Specifically:

- `loop` is N animations from the user's mental model but **one logical animation** for op purposes. The sugar (`tweenLoop` on a pose, etc.) emits the op once at loop start, snaps back to `from` if cancelled before completion. For looping that drives pose, the consumer should generally use ambient/visual loops (breathing handles), not loops that mutate scene data — the primitive doesn't gate this but the documentation steers it.
- `stagger` issues one op per child animation at that child's start. There is no "stagger op." Undo cancels in-flight + pending children and rolls back each child that has already started.
- `physics.setTarget` does **not** emit a new op. The op is the original animation's destination; retargeting is a mid-flight steer, not a separate logical animation. (If a consumer wants the retarget to be undoable as its own step, they call `cancel(handle)` then start a fresh animation — same pattern as today's discrete spring restart.)
- Pause/resume/timeScale never emit ops. They affect visual playback only; the underlying op already fired (or hasn't yet).

## Migration / compatibility

- `spring(o)` and `decay(o)` keep working. Internally they call `physics`. Existing tests pass without changes (modulo the `friction → damping` translation in `decay`, which uses the formula above; behavior matches within float epsilon).
- `momentum` MoveBehavior keeps using `decay` — no call-site changes.
- `AnimationHandle` gets four new methods. Consumers that never call them see no behavior change.

## Testing

Each subsystem gets a focused test file under `src/animation/`:

- `useAnimator.test.tsx` — extend existing tests:
  - virtual clock advances correctly under `setTimeScale`
  - pause freezes value; resume continues from the frozen point with no jump
  - global pause stops the rAF loop; resume restarts it
  - per-handle pause coexists with global pause (resume from global doesn't override per-handle paused state)
  - `pauseKey` pauses all matching, leaves others running
- `physics.test.ts` — new:
  - `physics` with `to` set matches `spring` numerically (parity test against existing spring fixture)
  - `physics` with `to: null` matches `decay` numerically (parity test against existing decay fixture, friction translated via `exp(-damping/mass)`)
  - `setTarget(null)` mid-flight: velocity preserved, decay begins
  - `setTarget(newTo)` mid-flight: velocity preserved, spring re-targets
- `loop.test.ts` — new:
  - primitive `loop` re-invokes factory on each child completion
  - `count` limits iterations; loop's `onDone` fires after the last child
  - cancel cancels the current child and prevents future iterations
  - pause cascades to the current child
  - `tweenLoop` direction: `restart` / `reverse` / `alternate` produce the expected value sequences
- `stagger.test.ts` — new:
  - primitive `stagger` fires children at the right virtual times under a mocked clock
  - composite handle cancel: in-flight + pending all cancelled
  - composite handle pause: in-flight paused, pending timers frozen and resumed correctly
  - fluent builder constructs equivalent factories (parity test against the primitive form)

`useAnimator` already has a `now` injection for tests; the same mock clock drives the new substrate. Stagger needs an injectable timer too — add `setTimer` / `clearTimer` to `UseAnimatorOptions` for parity with the existing `requestFrame`/`cancelFrame` seams.

## Demo

Extend `AnimationDemo` with:

- Pause / resume / time-scale slider over the running scene
- A breathing handle on the selected card (`tweenLoop` with `direction: 'alternate'`)
- Multi-select fade-in driven by `animator.stagger(ids, 50).springPose(...)`
- A "flick then snap" panel demonstrating `physics.setTarget` mid-flight (drag-flick the panel, on threshold it retargets to the nearest grid cell)

No new demo file — `AnimationDemo` becomes the showcase for the ergonomics layer.

## Risks

- **Virtual clock changes the shape of every animation's tick.** A bug in the `virtualNow` advance affects every animation. Mitigation: parity tests against the existing tween/spring/decay fixtures (same `onTick` outputs against the mocked clock both before and after the refactor).
- **`setTarget` could surprise consumers if it's called during a tick.** Mitigation: like cancellation, the new target takes effect on the next tick, not mid-tick.
- **Stagger timers held across React unmount.** The animator's existing unmount cleanup must also clear pending stagger timers, or pending children will fire onto a detached adapter. Mitigation: the `cleanupRef` in `useAnimator` extends to a "pending timer set" that `cancelAll` clears.

## Open questions

None blocking. Possible follow-ups once shipped:
- Animation events / observability (deferred separately) — would let `loop` and `stagger` emit per-iteration / per-child events for analytics or debug overlays. Hold for a real driver.
- Layout-strategy reflow integration (deferred separately) — depends on the layout-strategies primitive's final shape; not coupled to ergonomics.
