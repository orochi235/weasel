---
"@weasel-js/core": patch
"@weasel-js/labkit": patch
"@weasel-js/loupe": patch
---

Views now clamp zoom to a positive floor. A view's zoom is always finite and at
least `ZOOM_FLOOR` (1e-9); a zoom of 0, a negative one, `NaN` or `Infinity`
becomes the floor, and a non-finite position becomes 0. Dev builds warn once
when that happens. A negative `View.scale` axis is still a flipped (y-up) axis
and keeps its sign.

The rule lives in `normalizeZoom`, with `normalizeView` applying it to a `View`,
and every place a view enters the kit goes through it: `<Canvas>` and
`<SceneCanvas>` (the `view` and `defaultView` props, `setView`, the `view` dep),
`<CanvasView>` (including a thunked `view`), `<SceneViewCanvas>`,
`<MinimapCanvas>`, `createViewportLayer`, camera animation targets, `zoomAt`,
`fitViewToBounds` and `fitZoom`. In labkit, `CanvasStack`, `Stage`, `usePanZoom`,
`zoomAt`, `centerOn`, `ZoomControl`, a trial's zoom chrome and `as2DView` do the
same through the new `normalize2DView` and `withZoom`. A loupe's magnification
follows the same rule.

So `screenToWorld`, `canvasCoords` and affordance hit-testing stay finite
without handling a zero zoom themselves. `pxExtent` no longer guards a zero
axis, which a view can no longer have, and labkit's `zoomAt` now treats a
non-finite opening zoom as the floor rather than as 1.
