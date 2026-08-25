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
