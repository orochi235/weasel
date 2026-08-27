# Loops stop when nobody is looking

Status: shipped. This is the rule a new frame loop in weasel has to follow.

For someone writing or reviewing a loop in `@weasel-js/core`, `@weasel-js/ui`
or `labkit`. It answers: what stops a loop from burning CPU on a page the user
has walked away from, and what a loop has to do to earn that.

## The cost

Closing one WebGL lab page left open in a background window took Chrome's GPU
process from ~120% CPU to ~33%, and macOS `WindowServer` from ~126% to ~88%. A
continuously redrawing window is composited once per display, so the bill scales
with the desk: on five displays — four 6016×3384 framebuffers at 120 Hz,
downsampled to 4K panels — that is ~9.8 Gpx/s of surface, and a loop that is
cheap on a laptop is several times that there. Lab pages are the kit's own
output, and they are what gets left open for days.

## The rule

Every frame loop in the kit runs behind `useVisibleRaf`
(`packages/core/src/scheduling/useVisibleRaf.ts`), a public export of
`@weasel-js/core`. Nothing runs while `document.hidden`; a loop that names an
element also stops while that element is outside the viewport. A request made
while suspended is held rather than dropped, and re-armed on resume — so no
loop polls visibility itself, and none has to be restarted by hand.

`npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
in `packages/*/src`. It runs in CI. `tests/perf/hidden-loops.spec.ts` is the
only place the effect can be checked — jsdom never hides a document and its rAF
is a shim — and it measures a demo at 340 frames visible, 0 hidden, 365 on
resume while the browser keeps firing throughout.

```ts
const loop = useVisibleRaf(
  (time) => {
    …
    loop.request();   // a continuous loop asks for the next frame from inside
  },
  { target: hostRef },
);
```

## Rebase the clock, or fabricate a frame

**A loop that measures elapsed time must rebase in `onResume`.** Suspension is
not slow drawing: an hour hidden arrives as one hour-long frame, and the loop
reports it as real. An FPS meter prints a rate nobody achieved; a tween lands
at its end value the moment the tab comes back; a decay's momentum is spent
before it is seen.

The rebase is one line — drop the last timestamp, and treat the resuming
frame's interval as zero:

```ts
{ onResume: () => { lastFrameRef.current = null; } }
```

Loops with a fixed per-frame step (`useSimulation`'s integrator) have no clock
to rebase and need nothing.

## The escape hatch

`dangerouslyRunWhenHidden` runs frames regardless of visibility, for a loop
that is not painting for a viewer — an offscreen recording, an export driving
its own frames. Nothing in the tree sets it, and reaching for it to fix a loop
that stalls after a tab switch is always wrong: that is a missing `request()`,
and the flag hides it.

## Two things that look safe and aren't

**Painting only what is dirty is not the same as doing nothing.** A hidden tab
still commits React updates, and an effect keyed on view or size marks every
layer dirty and schedules a frame. Browser throttling slows that; it does not
stop it. `useLayerScheduler` had exactly this shape.

**`syncPaint` bypasses the frame, so it has to consult the gate separately.**
`useFrameLoop` paints in the caller's own stack when asked to, which is the one
paint a hidden tab would otherwise still perform.

## What is left

`prefers-reduced-motion` is deliberately not on this switch. It asks a
different question — consent, not cost — and a loop suspended for one reason is
not suspended for the other.
