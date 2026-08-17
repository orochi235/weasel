---
'@weasel-js/core': patch
'@weasel-js/gestures': patch
---

Six backlog entries, all in the input and hit-test layers.

Tool overlays can say where they sit. `Contribution.overlay` takes a
`RenderLayer` or an array of them, and a new `overlayPosition` (`'top'` — the
default — / `'before-selection'` / `'after-selection'`) anchors them against
the selection chrome instead of always landing on top; with no selection layer
in the stack the anchored positions fall back to the tail.
`getActiveOverlays(position?)` partitions, and `placeToolOverlays` in
`canvas/layerOrder.ts` does the splice, so the ordering is testable without a
GL context.

`drop` and `paste` are route-grammar gesture names. They shipped without them,
so the inspector reported `undefined` for every ingestion binding. Both are
targetless and carry the spec's MIME-glob filter as their arg — `drop(image/*)`.

An unhandled paste stays the page's. `onPaste` now dispatches first and calls
`preventDefault` only on `'handled'`, the shape `onWheel` already used.
Clipboard items materialize synchronously, so unlike `onDrop` the result is
known while the default can still be suppressed.

Marquee and lasso see the shape a node actually draws. `hitTestArea` asked the
*pose* for a silhouette, which meant the kit's own inserted shapes — geometry
on `node.data.path` behind a plain `{x,y,w,h}` pose — took the AABB path and
kept every false positive the silhouette test exists to drop. It now asks
`findShapeSilhouette` for the drawn world-frame boundary. Paying for that is a
containment short-circuit: a node the rect marquee swallows whole is a hit no
silhouette can overturn, so neither the kernel nor the painter runs. Net
against the committed bench baseline, polygon-pose scenes gain (1.25x at 1000
nodes / 100% area) and plain-rect scenes lose ~8% on the two rows that scan
everything. The short-circuit is marquee-only, behind `hitTestAreaPolygon`'s
`areaIsRect` flag, because a node inside a lasso hull's bounding box can still
miss the hull.

Layout siblings reflowing mid-drag render opaque. `OngoingHandle.previewOpaqueIds()`
names the subset of `previewIds()` that skips the ghost alpha; `moveAction`
fills it from the destination and source reflow ids. A ghost means "in flight
under the pointer", which a sibling settling into its destination slot is not.

`LayoutStrategy.acceptsDrop(container, dragged)` rejects a drag before any
drop-target work, so a type-aware container falls through to whatever sits
under it rather than swallowing everything in its bounds.

`flipAction` reads `params.pivot`. `'each'` (the default, unchanged) mirrors
every pose about its own AABB; `'union'` mirrors about the selection envelope
so items swap sides, and the `geometryProjection` data op follows the same
pivot.
