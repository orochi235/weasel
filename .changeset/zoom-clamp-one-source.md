---
'@weasel-js/core': patch
---

Zoom now has one clamp. `DEFAULT_MIN_ZOOM` / `DEFAULT_MAX_ZOOM` are exported from
`@weasel-js/core` and every zoom path defaults from them — `zoomAt`, the
`viewport.zoom` and pinch actions, `usePinchZoomTool`, `fitViewToBounds`,
`computeWheelAction` and `useZoom`.

**Behavior change:** the three paths that carried the second, undocumented pair
now cap at 8x rather than 10x. `fitViewToBounds` could previously land at 10x and
the next pinch frame would clamp it straight back to 8x. Pass an explicit
`maxScale` / `max` to keep 10x.
