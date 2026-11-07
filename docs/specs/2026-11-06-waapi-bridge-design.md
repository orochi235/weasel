# Handing animator runs to the browser compositor

**What:** a bridge from `@weasel-js/animator` to `Element.animate`, so a run on a DOM element plays on
the browser's compositor thread with no per-frame main-thread work. **For:** anyone animating many
DOM overlays, labels, or HUD-like elements with weasel's animator. **Question it answers:** what can
be handed off, what stays on the main thread, and how a handed-off run stays on weasel's clock.
**Status (2026-11-06):** building on branch `waapi-bridge`; this file is deleted once the durable
parts are in `docs/concepts.md` ("Element targets").

## Public API

```ts
import { createElementTarget } from '@weasel-js/animator';

const dot = createElementTarget({
  element: el,
  value: { x: 0, y: 0, o: 1 },
  style: (v) => ({ transform: `translate(${v.x}px, ${v.y}px)`, opacity: v.o }),
});
animator.tween({ target: dot, to: { x: 200, y: 0, o: 0.5 }, ms: 400 });   // on the compositor
animator.spring({ target: dot, to: { x: 0, y: 0, o: 1 }, compositor: 'require' });
```

- `createElementTarget(opts)` returns an ordinary `Target<T>`: every animator call works on it.
  On the main thread it writes `style(value)` inline each frame.
- Every target animation takes `compositor?: 'auto' | 'off' | 'require'` (`CompositorMode`).
  `'auto'` (default) hands off when eligible, `'off'` never, `'require'` throws with the reason.
- `animator.live()` rows carry `compositor: true` while a run is handed off.
- `COMPOSITOR_PROPERTIES` names the properties that count as compositor-run.

## Eligible, and what falls back

| Runs on the compositor | Stays on the main thread |
|---|---|
| `tween`, `spring`, `decay`, `physics` (and so `loop`, `stagger` built on them) on an element target | anything on a plain `createTarget` target, a target-table row, or a pose/scene target |
| style of `transform`, `translate`, `rotate`, `scale`, `opacity` | any other property (`backgroundColor`, `width`, …) |
| the only thing moving its target | a run joining another animation or a hold on the target (they add) |
| any easing, interpolator, or angle axis: the run is sampled into keyframes | an `onTick` (it needs a value each frame) |
| | a zero-length tween, a spring already at rest, an environment with no `Element.animate` (jsdom) |

**WebGL-drawn scene nodes cannot be handed off.** The renderer draws every node on the main thread
into one canvas each frame; there is no per-node compositor layer to animate, and no browser API
animates a value inside a WebGL draw. Nothing in this bridge applies to them. Scene animation keeps
its main-thread cost; the HUD (also WebGL) likewise.

## Staying on weasel's clock

The animator's clock is the authority; the browser animation is a projection of it, re-anchored
whenever the two could part.

- **Start:** the run's whole motion is a pure function of its own clock (tween: easing over the
  path; spring/coast: the closed form of `m y'' = -k y - c y'`, the same equation the main-thread
  path solves), sampled at `sampleRate` keyframes a second (default 60, at most 600 a run) into
  `element.animate(frames, { duration, fill: 'both' })`.
- **Placement:** `playbackRate = ownRate × animatorPace`, `startTime = wall − own / rate`, where
  `wall` is the document-timeline time at which the animator's clock reads what it reads. Paused
  (rate 0): `pause()` and `currentTime = own`.
- **Pause, resume, time scale, reverse** (per handle, per key, animator-wide): placed again at once.
- **Seek and ramps of an outside clock** (`useAnimator({ clock })`), **time unseen** (hidden tab):
  after each frame the animator compares its clock with the pace the browser kept; past 0.5 ms of
  drift, or on a pace change, every run is placed again. O(1) a frame otherwise.
- **End:** the animator's own schedule ends the run at its end (or start, played backward); it writes
  the final value inline, then cancels the browser animation, so nothing flashes.
- **Cancel / interrupt / `target.stop()`:** commits where the motion stands on the animator's clock,
  writes it inline, cancels the browser animation.
- **Take-back:** when another animation, a hold, or `target.commit` reaches a handed-off target, the
  run is taken back: the browser animation is canceled and the rest of the run continues on the main
  thread as a child under the same `cancelKey` (a spring or coast as physics from its position and
  velocity, a tween along the rest of its path), so the two add with no jump. Its handle keeps
  working. Played backward past the take-back point, it ends there.
- **Physics retarget:** `setTarget`/`setVelocity` re-sample from the run's current position and
  velocity and stay on the compositor.

## Measured

`tests/perf/compositor-handoff.spec.ts`: page frame rate (rAF) and drawn frame rate (`DrawFrame`
in a Chromium trace) for each path at 500–6000 concurrent element tweens. Results: pending.
