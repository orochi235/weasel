# Camera animation

**What this is:** the design for animating the viewport `View` — the surface the
kit exposes, which view changes glide and which must not, and what stops one
mid-flight.

**Who it's for:** whoever implements it. Assumes `View`
(`core/viewport/view.ts`), the action/dep layer (`docs/taxonomy.md`), and the
frame loop from `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`.

**What it answers:** where a camera tween lives now that `setView` costs no
React render, and what becomes of the two exported hooks that already claim to
do this.

---

## What is there now

`SceneCanvasProps.viewport.animatedZoom` is declared, documented, and read by
nothing. Cmd+= is a bare `view.set` in `viewportZoomAction`
(`interactions/actions/defaults/viewportZoom.ts`) and jumps.

`useViewTween` hand-rolls a `requestAnimationFrame` loop, a `lerp`, and a
private `easeOutCubic` — while `packages/core/src/animation` exports
`easeOutCubic` alongside forty other easings, plus `useAnimator`, which owns one
rAF loop per canvas and already handles cancel-keys, pausing and time-scaling.
`useViewAnimation` wraps `useViewTween` and adds a fit-to-bounds convenience.
Both are exported from `index.ts`; neither has a consumer in the tree.

Two problems, one fix: the tween runs on the animator, and `animatedZoom`
becomes the policy switch that routes the keyboard zoom through it.

---

## The surface

A camera animation is a view change with a duration. It is not a property of
the zoom binding, so it is not declared there. Three layers, one runner:

**`useViewAnimation(view, animator?)` — the hook.** A leaf: it takes a channel
to read and write the view through, and an optional animator (it makes its own
when omitted).

```ts
export interface ViewChannel { get(): View; set(v: View): void }

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

export interface ViewAnimationApi {
  /** Glide from the live view to `to`. A thunk receives the pending target
   *  when one is in flight, so successive steps compound. */
  animate(to: View | ((base: View) => View), opts?: ViewAnimationOptions): void;
  /** `fitViewToBounds` composed with `animate`. */
  animateToBounds(bounds: Bounds, dims: ViewportDims, opts?: AnimateToBoundsOptions): void;
  /** Cancel. The view stays where it is — no jump to the target. */
  stop(): void;
  isAnimating(): boolean;
  /** Where the in-flight animation is heading, or null. */
  target(): View | null;
  /** Cancel unless the write that prompted this came from the runner's own
   *  tick. The interruption rule, in one predicate. */
  stopIfExternal(): void;
}
```

**`ViewApi` — the dep.** `depSchema.ts` has said since it was written that the
`view` dep "may include animation helpers" later. This is that:

```ts
export interface ViewApi {
  get(): View;
  set(v: View): void;
  recenter?(): View | void;
  hostSize?(): { width: number; height: number } | null;
  animate?(to: View, opts?: ViewAnimationOptions): void;
  stopAnimation?(): void;
  animationTarget?(): View | null;
}
```

The three new members are optional for the same reason `recenter` and
`hostSize` are: a consumer publishing their own `view` dep must not be forced to
implement a camera runner, and an action that wants animation falls back to
`set` when they are absent.

`recenter` widens from `() => void` to `() => View | void`. A callback that
sets the view itself cannot be tweened — the kit never sees the target. Returning
it is how a consumer opts Cmd+0 into the same treatment; returning nothing keeps
today's fire-and-forget contract.

**`SceneCanvasApi` — the ref handle.** `animateView`, `stopViewAnimation`,
`isViewAnimating`, delegating to the same runner, for consumers who drive the
camera directly rather than through an action (a scripted tour, a
fit-to-selection button, a minimap click). It goes on `SceneCanvasApi` rather
than `CanvasExtensionApi` because the bare primitive has no animator; `Canvas`
keeps `setView` and nothing more.

**Where the animator comes from.** `SceneCanvas` calls `useAnimator()` for the
camera and never borrows the one passed as the `animator` prop. That prop means
"repaint on this animator's ticks"; a consumer calling `cancelAll()` or
`pause()` on their own animator is talking about their scene animations, and
should not strand a zoom half-finished or freeze the camera. One `Animator`
implementation, one more instance, active only while the camera is moving.

---

## What animates

**A view change animates when the input hands it a target and no intermediate
samples.** That is the whole rule.

- **Cmd+= / Cmd+- / Cmd+0** — one keystroke, one target, nothing in between.
  These animate when `animatedZoom` is on.
- **Wheel zoom, trackpad pinch, two-finger pinch, hand-drag pan** — the input is
  already a stream of per-frame samples. Tweening between them adds latency and
  the next sample cancels the tween anyway. These never animate, at any setting.
- **`fitViewToBounds`** — a pure function returning a target `View`. Nothing to
  change: `view.animate(fitViewToBounds(bounds, dims, view.get()))` is the
  fit-to-selection case, and `animateToBounds` is that line pre-composed.
- **`viewport.recenter`** — animates when the consumer returns the target.
- **`handle.setView`** — stays instant. Animation is opt-in per call, via
  `animateView`.

`animatedZoom` resolves into the `viewport.zoom` action's own options — a
`SceneCanvas`-level spelling of an action-level knob, which is the same shape
`viewport.pinchZoom` takes once the `mac-pinch-zoom` branch lands it on
`makePinchZoomAction({ min, max })`:

```ts
viewport?: {
  /** Tween the discrete zoom steps (Cmd+=/-/0) instead of jumping. */
  animatedZoom?: boolean | { ms?: number; resetMs?: number; easing?: EasingFn };
  zoom?: boolean | ViewportZoomOptions;   // gains `animate?: boolean | …`
}
```

The declared-but-dead fields were `duration` / `resetDuration`. They become `ms`
/ `resetMs` — the animator's vocabulary, and the unit is in the name. Nothing
reads the old spelling, so nothing breaks.

---

## The interpolation

Zoom is perceptually multiplicative, so scale interpolates geometrically:
`s(t) = s0 · (s1/s0)^t`. A linear lerp from 1× to 8× is past 4× at the halfway
point and crawls from there; the geometric path passes through 2.83×, and each
frame changes the view by the same *ratio*. The exponential form is also why an
overshooting easing (back, elastic) cannot invert the camera — it has no zero.

Translation follows from the fixed point rather than being lerped alongside.
Two views that differ in scale agree at exactly one screen point per axis:

```
p = (x1 - x0) / (1/s0 - 1/s1)      w = p/s0 + x0      x(t) = w - p/s(t)
```

Holding `w` under `p` for the whole tween is what makes a zoom look anchored
instead of drifting. Every discrete zoom in the kit is already anchored —
`zoomAt` preserves the point under `keyAnchor`, the host center — so `p` comes
out as the host center, and it stays the host center across a retarget, because
a view sampled mid-tween is still center-anchored against the next target.

When the two scales are equal there is no fixed point: that is a pure pan, and
`x` lerps linearly. Both axes are computed independently, since `View.scale` is
a 2-vector and `zoomAt` clamps per axis.

This lives in `core/viewport/interpolateView.ts` as an `InterpolatorFactory<View>`
— built once per animation, called with eased `t` per frame — which is the shape
`Animator.tween` already takes.

---

## Interruption

**One camera animation per canvas.** Everything registers under
`cancelKey: 'view'`, so a new one displaces the old through the animator's own
mechanism.

**A new step retargets from the pending target, not from the live view.** Three
fast presses of Cmd+= land on 1.25³, not on 1.25× wherever the first tween had
got to. The action reads `view.animationTarget() ?? view.get()`.

**Every animation starts from the live view.** There is no captured `from` to go
stale, so an interrupted-and-restarted tween picks up where the camera actually
is. `useViewTween.animateTo(from, to)` cannot express this — its `from` is an
argument — which is why the signature does not survive.

**Any view write the runner did not make cancels it.** One predicate,
`stopIfExternal()`, fed from the canvas's own `onViewChange`. `Canvas.setView`
calls that on both branches — the controlled one forwards to it instead of
writing locally — so hand tool, pinch, wheel, inertia and `handle.setView`
cancel a glide whether or not the consumer owns the view. (`subscribeView` is
not the feed: the controlled branch returns before notifying subscribers. Nor
is the `view` dep's `set`, which only sees writes routed through an action;
it feeds the predicate too, for a `view` dep wired to something other than a
`<SceneCanvas>`.) The runner raises a flag around its own per-frame write so it
does not cancel itself — the same re-entrancy shape `animateOnSetPose` guards
with `isTicking()`, and it needs its own flag rather than that one, because a
consumer's scene animation writing the camera from its `onTick` is external and
must cancel.

One write is out of reach: a controlled consumer calling their own `setState`
without going through the canvas. The prop change arrives asynchronously, after
the runner's flag has been lowered, so it is indistinguishable from the runner's
own frame — see `docs/TODO.md`.

**`stop()` leaves the view where it is.** No jump to the target, matching
`Animator.cancel`.

**Nothing reaches the undo stack.** History is fed only by `executeAndLog` /
`scene.batch`; the view is a ref plus a subscriber set, and `setView` writes
neither ops nor a scene version. A camera tween is free of history at any frame
rate, and no journaling guard is needed.

---

## What the frame loop gives it

Each tick writes `view.set` → `Canvas.setView` → the dirty flag → the next
frame paints. No `requestRedraw` call, and no `keepAlive`: `keepAlive` exists for
effects with no progress state, and a tween has one. `subscribeFrame` is for
chrome that must observe landed pixels and is not involved.

**Hidden tabs need no code.** The browser stops firing rAF, so the animator
stops ticking and the frame loop refuses to paint anyway. On return, the
animator's first `realDt` is the whole gap, `t` clamps to 1, and the camera is
already at its target — which is what should have happened while nobody was
looking.

**A controlled canvas pays a render per frame.** `view.set` there routes to
`onViewChange` and the consumer's `setState`; the camera cannot take the
imperative path, because the prop is the authority. That is the existing cost of
any per-frame view change on a controlled canvas, not a new one — but it is why
the arc's "a camera tween is free" holds for uncontrolled canvases only.
`apps/draw` is controlled and animates nothing today; it stays that way.

---

## What goes away

**`useViewTween` is deleted.** Its rAF loop, its `lerp` and its private
`easeOutCubic` are the three things `animator.tween` replaces.

**`useViewAnimation` keeps its name and changes its signature.** It becomes the
kit's one camera-animation hook. `animateToBounds` survives, rebuilt on
`animate`.

Both are exported with no in-tree consumers, so this is a breaking change to
published surface with no migration inside the repo. For anyone outside it:

```ts
// before
const { animateTo } = useViewTween(setView);
animateTo(current, target, { duration: 250, easing: easeOutCubic });

// after
const { animate } = useViewAnimation({ get: () => current, set: setView });
animate(target, { ms: 250, easing: easeOutCubic });
```

`from` disappears because the runner reads the live view.

---

## Not in this arc

`useDecayLoop` is a third bespoke loop, of the same shape, behind hand-tool
inertia — and `animation/behaviors/momentum` plus `Animator.physics` are what it
would fold into. It is a separate change with its own boundary/bounce semantics
to preserve, and it does not block this one.
