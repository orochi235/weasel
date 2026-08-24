---
'@weasel-js/core': patch
---

Let a view build its own helpers and hand them to its layers.

`<CanvasView>` now calls `useViewHelpers` and passes the result through the
viewport node's `data` thunk: its source layers draw against this view's chrome
state, effective poses and gesture bounds, with the surface half of the
envelope — debug sink, chrome-caps predicate — passing through untouched.

The inputs that hook needs are surface-wide (adapter, geometry, bounds
resolver, tools, gesture source) and are read during a view's render, so
`<SceneCanvas>` publishes them as context rather than on the `SurfaceHandle`,
which is not attached until an effect runs.

Layers that read chrome off the draw envelope — affordance layers, the
selection overlay's multi-union — follow the view. The selection overlay's
per-id outline and handles still come from closures over the surface's
selection.
