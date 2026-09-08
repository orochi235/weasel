---
'@weasel-js/core': patch
---

One wheel convention across the kit. Breaking: `computeWheelAction` changes
shape, and `useZoom` / `usePinchZoomTool` are gone.

Three public entry points answered the wheel and disagreed with each other.
`viewport.wheelPan` + `viewport.zoom` panned on a bare wheel and zoomed on
Cmd/Ctrl+wheel; `computeWheelAction` did the opposite, zooming on a bare wheel
and treating Cmd+wheel as a vertical scroll; `useZoom` zoomed on a bare wheel
and never panned. The two reducers also panned in screen pixels against a
`{ zoom, panX, panY }` state that is not a `View` and cannot be handed to
`view.set`.

The surviving convention is the one the dispatcher already ships: bare wheel
pans, shift+wheel pans horizontally, Cmd/Ctrl+wheel zooms under the pointer,
and a trackpad pinch (which browsers deliver as ctrl+wheel) zooms. Coordinates
are `View` throughout — a pan delta arrives in screen pixels and is divided by
`View.scale` before it lands, and a zoom anchor is canvas-local.

`computeWheelAction(view, input, clamp?)` now takes and returns a `View`. Its
halves, `wheelPan` and `wheelZoom`, are exported alongside `wheelZoomFactor`,
and `viewport.wheelPan` / `viewport.zoom` call them rather than restating the
math — so the wired path and the pure one cannot drift again. `WheelState` and
`ZoomBounds` are removed; `WheelInput` names its anchor `x`/`y` instead of
`mouseX`/`mouseY` and reads `ctrlKey`. Zoom is now `1.1^(-deltaY/100)` on
every path, which is reciprocal: scrolling a distance and back returns to the
scale you started from, where the old `1.1`/`0.9` pair did not.

A pinch anchors under the fingers in canvas-local coordinates. The dispatcher
converts the multitouch centroid the same way it already converted the wheel
anchor; on a canvas offset from the viewport top-left, `viewport.pinchZoom`
was anchoring on raw client coordinates and drifting by that offset.

`useZoom`, `UseZoomOptions` and `UseZoomReturn` are removed. They were
deprecated, had no consumer, and were the third convention.

`usePinchZoomTool` and `PinchZoomToolOpts` are removed, with the `viewport`
prop on the unexported `<Canvas>` primitive and the `ViewportConfig` type that
typed it. `viewport.pinchZoom` on `<SceneCanvas>` is unaffected — it is the
action, and it is now the kit's only pinch path. `usePinchGesture`, the raw
two-finger listener underneath, stays.
