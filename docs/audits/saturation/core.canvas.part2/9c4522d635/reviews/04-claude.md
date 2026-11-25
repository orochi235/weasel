## `paintLodBox` memoizes the box fill without keying on `inherited`, so an `'inherit'` fill goes stale
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group, zoomed out until its ladder picks the `box` rung. `nodeMemo(node, SLOT, pose, derive)` keys on the node object and pose only; `inherited` (the container's fill) is read inside `derive` but not passed as `nodeMemo`'s `also` argument. Change the group's fill: the child node object and pose are unchanged, so the memo returns the box commands built with the old inherited fill, and the box rung keeps painting the old color until the child itself is edited. The same goes for a group whose box falls back to `d.fill` resolved against `inherited`. It should pass `inherited` (or its fill) as the memo's `also` key.
- evidence: read (nodeMemo signature in core/scene/nodeMemo.ts:86 takes `also`; lodBox omits it)
- severity: medium

## The painted cursor averages signed view scales, so a mirrored view shrinks or hides a world-sized cursor
- where: packages/core/src/canvas/paintedCursorLayer.ts:86 (createPaintedCursorLayer draw)
- scenario: a view with a flipped axis, `scale: { x: -2, y: 2 }`. `(view.scale.x + view.scale.y) / 2` is 0, so `worldCursorPx` gives size 0 and the `!(size > 0)` guard draws no cursor; with `{ x: -2, y: 1 }` it is −0.5, again nothing. Everywhere else the kit reads the scale magnitude: `pixelScaleAt` takes `Math.abs`, and `meanScale` (`@weasel-js/geom`) is `sqrt(|x·y|)`. This is the same question answered two ways; it should use `meanScale(view.scale)` or the absolute values.
- evidence: read
- severity: low

## `collapseRungs` caches one ladder for each distinct `collapseBelowPx`, with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:59 (byCollapse / collapseRungs)
- scenario: a consumer drives `LodOptions.collapseBelowPx` from a slider or from a value computed per zoom. Every distinct number adds an entry to the module-level `byCollapse` Map, and nothing ever evicts one, so a long session keeps growing it. It should be capped, or held in a single slot keyed on the last `px`.
- evidence: read
- severity: low

## `LodState` keeps a walk key's map after that key stops being walked, and `find` still reads it
- where: packages/core/src/canvas/lod/lodState.ts:45 (createLodState find / begin)
- scenario: a map is replaced only when `begin(key)…end()` runs again for the same key. If a scene layer is removed, or its walk no longer runs, its last map stays in `walks` for good. `rungOf`, `skips` and `collapsedAbove` search every map in insertion order and return the first match. So a node id that comes back (undo of a delete, or a node moved onto a layer that is walked later in order) can be answered from the stale map, for example as `'none'`, which `pickWalk` treats as unpickable. This also contradicts `size()`'s doc ("at most what the walks of the last frame visited").
- evidence: read (inference about which walks stop running)
- severity: low

## Files read
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/lod/ladder.ts
packages/core/src/canvas/lod/lodBox.ts
packages/core/src/canvas/lod/lodState.ts
packages/core/src/canvas/lod/lodWalk.ts
packages/core/src/canvas/mountedCanvases.ts
packages/core/src/canvas/nodeOutline.ts
packages/core/src/canvas/nodeShapeRegistry.ts
packages/core/src/canvas/nodeShapeTypes.ts
packages/core/src/canvas/overChildren.ts
packages/core/src/canvas/overlayRoleStrokes.ts
packages/core/src/canvas/ownClip.ts
packages/core/src/canvas/paintCull.ts
packages/core/src/canvas/paintOverrides.ts
packages/core/src/canvas/paintStandIns.ts
packages/core/src/canvas/paintedCursorLayer.ts
packages/core/src/canvas/pasteOnPages.ts
packages/core/src/canvas/pasteShape.ts
packages/core/src/canvas/pathOverlay.ts
packages/core/src/canvas/pbt.fixture.ts
packages/core/src/canvas/pickIndex/nodeBroadBox.ts
packages/core/src/canvas/pickIndex/pickIndexFixture.ts
packages/core/src/canvas/pickIndex/scenePickIndex.ts
packages/core/src/canvas/pickReach.ts
packages/core/src/canvas/pickWalk.ts
packages/core/src/canvas/pixelPick.ts
packages/core/src/canvas/pixelRenderRect.ts
packages/core/src/canvas/pixelScale.ts
packages/core/src/canvas/planeClips.ts
packages/core/src/canvas/poseRotation.ts

<!-- done: 4 findings, files read: 39 -->
