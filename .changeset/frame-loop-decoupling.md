---
'@weasel-js/core': patch
---

Paint the canvas from its own animation frame instead of from a React render

`requestRedraw()` marks the surface dirty and the next frame paints, so many
redraws in one tick cost one paint. The view gains an imperative path on the
canvas handle — `setView` / `getView` / `subscribeView` — and `SceneCanvas` no
longer holds it in React state, so a camera moving at 60 Hz costs no renders.
Consumers passing a `view` prop stay controlled and are unaffected.

Opt-ins that come with it: `syncPaint` paints inside the commit for a consumer
that wants the old whole-cloth guarantee, `useScene(…, { subscribe: false })`
gives a host the scene without a render per mutation, `useSceneTextEdit`'s
`view` option accepts a thunk so the overlay tracks a ref-driven camera, and a
`contentVersion` prop feeds the version that `getPaintedVersion()` reports.

Two public signatures changed. `usePinchZoomTool` takes a view getter,
`getView: () => View`, where it took a `View` — nothing re-renders to refresh a
captured value any more. `CanvasExtensionApi` gained five required members —
`getView`, `setView`, `subscribeView`, `subscribeFrame`, `getPaintedVersion` —
so external code hand-implementing that interface stops typechecking; code that
only calls through the ref is unaffected.

Canvas pixels may now be one frame ahead of DOM rendered from the same data.
Anything reading the drawing buffer back outside a paint — the hud loupe's pixel
mode is the one in-tree case — can likewise see a buffer one frame older;
`subscribeFrame` runs on the frame that painted and removes the lag. Position
world-anchored DOM from `subscribeView`, and compare `getPaintedVersion()`
against the version you are about to render when chrome must be in lockstep. Do
not render scene-derived DOM inside `startTransition` — React defers it and
nothing forces it to catch up.
