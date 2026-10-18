---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
---

More of the kit boxes a stroked node by its stroke as drawn, through `drawnBoundsOf`:

- The selection overlay takes a `scene`. With it, a pose from `getPose` is outlined on the node's stroke, and a container's union takes its members as drawn. `<SceneCanvas>` passes its scene when a `selectionOverlay` slot supplies its own `poseById`, unless `geometry.boundsIncludeStroke` is `false`.
- `composeSelectionPose` takes a `scene` and a `viewScale`, so a selected container's pose reaches its members' strokes.
- `useAlign` takes a `scene` and a `viewScale`, and lines up drawn edges when given them.
- `<Canvas>` takes `nodes`, and its default bounds then box each node as drawn.
- `kit:text` reports a `drawnBounds`: a stroked line that reaches its layout box's edge grows the box by the stroke's reach.

A `{ px }` stroke is now measured as the renderer draws it. `drawnBoundsOf`'s `scale` accepts a per-axis view scale, and with one it hands painters `NodeInkCtx.screen`, the map from the node's frame to screen pixels. Rects, ellipses, and text outset each side by the stroke as it lands on screen, and paths, polygons, and stars build the ribbon in the same space the renderer does, so the box is exact under a stretched view and under a skewing or stretching `transform` rather than right only at the mean scale. Chrome, resize, rotate, flip, align, and distribute pass the view's per-axis scale.

`@weasel-js/renderer` exports `resolveStrokeLengths`, which resolves a stroke's `{ px }` lengths against a transform and names the spaces each part is built in.
