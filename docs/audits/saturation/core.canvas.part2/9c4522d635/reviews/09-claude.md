## The `box` LOD rung memoizes its fill without the inherited paint, so an `'inherit'` node keeps a stale color
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group, zoomed out so it draws at the `box` rung. Edit the group's fill (the child's node object, `data` and pose are unchanged). `nodeMemo(node, SLOT, pose, …)` keys on node, pose and `data` only (`nodeMemo.ts:105`); `inherited` is not passed as the `also` argument, so the memo hits and the box keeps the container's old fill until the child itself is edited or the memo generation moves. It should repaint with the new inherited fill; passing `inherited` (or `inherited?.fill`) as `also` would fix it. Same for a group whose own `fill` is `'inherit'`.
- evidence: read
- severity: medium

## `collapseRungs` caches one ladder per `collapseBelowPx` value ever seen, with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:83 (collapseRungs, `byCollapse`)
- scenario: a consumer drives `LodOptions.collapseBelowPx` from a slider or an animated value (any non-integer stream). Every distinct number adds a module-level `Map` entry that is never removed, so the map grows for the life of the page. It should hold a bounded set (e.g. the last value only, or a small LRU).
- evidence: read
- severity: low

## Fitting a zero-extent insert preview reports bounds the fitted geometry does not occupy
- where: packages/core/src/canvas/insertPreviewExtent.ts:64 (fitted)
- scenario: a vertical `line` preview (`b.width === 0`) fitted to a `lands` box with `width > 0`. `sx` is 1, so the geometry is only moved to `to.x` and keeps zero width, but the result's `bounds` is `to` with its full width. The preview paint, commit and gesture bounds (which this module is "the one answer" for) then disagree: the AABB claims a width the shape has not got, and the line sits on the box's left edge rather than where the box is. `bounds` should be the box of the transformed geometry (width 0 on that axis).
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

<!-- done: 3 findings, files read: 39 -->
