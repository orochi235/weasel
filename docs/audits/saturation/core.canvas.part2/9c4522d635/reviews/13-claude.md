## The `box` rung's memo ignores the inherited fill, so a container's fill change leaves the box stale
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group, zoomed out to its `box` rung. Change the group's `fill`. The child node object, its `data` and its pose are unchanged, so `nodeMemo(node, SLOT, pose, …)` hits and the box keeps the old color until something else bumps the memo. `boxFillOf` reads `inherited`, which never reaches the key; `nodeMemo`'s fifth `also` argument exists for exactly this ("such as the paint a node inherits from its container") and is not passed.
- evidence: read (nodeMemo.ts:82-105 keys on pose, data, also, generation only)
- severity: medium

## The painted cursor scales a world-sized glyph by the arithmetic mean of the view axes, not `meanScale`
- where: packages/core/src/canvas/paintedCursorLayer.ts:87 (createPaintedCursorLayer draw)
- scenario: a view with a flipped y axis (`scale {x: 2, y: -2}`, which `pixelScaleAt` and `meanScale` both guard with `Math.abs`) gives `scale = 0`, so `worldCursorPx` returns 0 and the world-radius cursor is not drawn at all. Under non-uniform zoom it also disagrees with `meanScale` (sqrt|xy|), the one "single scale for a radius" every other path in the canvas uses (`pixelScaleCtx`, `buildSceneTree` clip scale), so the brush ring is sized differently from the paint it previews.
- evidence: read (geom/src/meanScale.ts)
- severity: medium

## `byCollapse` grows one entry per distinct `collapseBelowPx` ever used, never pruned
- where: packages/core/src/canvas/lod/lodWalk.ts:61 (collapseRungs)
- scenario: an app exposing `collapseBelowPx` as a continuous slider (or deriving it from dpr/zoom) creates a new `Resolved` in the module-level `Map<number, Resolved>` for every float it ever sees; the map is never bounded or cleared for the life of the page.
- evidence: read
- severity: low

## `fitted` reports the target width for an axis the geometry has no extent on, while the geometry stays zero-wide
- where: packages/core/src/canvas/insertPreviewExtent.ts:64 (fitted)
- scenario: a horizontal line insert (`a.y === b.y`, extent height 0) with `lands` of height 20: `sy = 1`, the line is moved to `to.y`, but `bounds` is returned as `to` with `height: 20`. The extent's `bounds`, documented as "World-space AABB of `geometry`", no longer bounds its geometry: the reported gesture bounds and commit box are 20 tall around a line drawn along their top edge.
- evidence: read
- severity: low

## `collapsedAbove` returns the outermost collapsed ancestor while its doc says the nearest
- where: packages/core/src/canvas/lod/lodState.ts:17 (LodState.collapsedAbove) / :48
- scenario: ancestors `[inner, outer]`, both drawn at a skipping rung. The interface promises "The nearest of `ancestors` (innermost first)", i.e. `inner`; the implementation walks from the end and returns `outer`. A caller using the returned id (to select or highlight the group that answers for the hit) gets a different group than documented.
- evidence: read
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

<!-- done: 5 findings, files read: 39 -->
