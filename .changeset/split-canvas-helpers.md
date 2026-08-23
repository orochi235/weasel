---
'@weasel-js/core': patch
---

Split `CanvasHelpers` into its per-view and per-surface halves.

`CanvasViewHelpers` is what one camera's own tools, gestures and selection
answer — `getEffectivePose`, `getEffectiveBounds`, `getGestureBounds`,
`subscribeGestures`, `getGestureVersion`, `getChromeState`.
`CanvasSurfaceHelpers` is what a GL context has one of — `getDebug`,
`getIsVisible`. `CanvasHelpers` extends both and is unchanged for layers, which
still receive the whole object as their `data`.

The two are now built separately inside `<Canvas>`, so which side a lookup
belongs on is a compile-time fact instead of a claim in a design doc. That is
the boundary a canvas hosting several viewports has to build N of one side and
one of the other across.
