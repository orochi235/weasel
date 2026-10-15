---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/renderer': patch
'@weasel-js/stroke': patch
'@weasel-js/svg': patch
---

Dynamic corners: any corner anchor of a path can be rounded, chamfered, or inverted, and its radius changed later. `resolveCornersWithSources` also answers which source anchor each expanded anchor came from, and `remapPerAnchor` carries a per-anchor array across, so the renderer draws `vertexColors` on a cornered path with every point of a cut in its corner's color. Additive: `PolygonPath` gains `corners`, an optional `CornerSpec` (`{ style: 'round' | 'chamfer' | 'inverted', radius }`) per flat anchor index. The command stream keeps the bare anchors, and `resolveCorners` expands the specs into plain geometry, each cut clamped so that the two cuts on a segment never overlap. Every reader of a path's geometry calls it first: tessellation, `extractPolylines`, the hit tests, `boundsOfPath`, `pathDistanceToPoint`, the booleans, `offsetPath`, the renderer's path draw, and `serializePathD`, which `@weasel-js/svg` now exports. A spec rides on its anchor through `pathToAnchors` / `anchorsToPath` (`PenAnchor.corner`), so anchor inserts and deletes keep it in place, and `transformPath` scales radii with the geometry. Also new: `cornerFrames` and `cornerFrameAt` (where each corner anchor can be cut, and how far), `withCorner`, `cornerAt`, `cornerSpecAt`, `nextCornerStyle`, `cornerTrimOf`, and `cornerRadiusOf`.

In path edit, each corner anchor shows a widget just inside it. A drag on one (`editCornerAction`, hit as `corner:N`, matched by routing's new `isCornerWidget`) sets the corner's radius live and commits one undo step; pressing the widget of a selected anchor sets every selected corner. `cycleCornerStyleAction`, in the `anchors` group, steps the selected corners through round, chamfer, and inverted, and `setCornersAction` sets their style or radius from its `style` and `radius` params, typed for `<SceneCanvas tune>` in `ActionParamSchema`.

A `PathEditHost` can own the anchor selection too, through optional `selectedAnchors` and `setSelectedAnchors`, so an app seeds which anchors start selected and shows what is selected. Giving a sharp corner a style, through `setCorners` or `cycleCornerStyle`, also gives it a radius: the call's own, or a quarter of the room the corner has.
