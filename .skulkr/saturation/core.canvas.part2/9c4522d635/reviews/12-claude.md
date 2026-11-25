## The `box` rung's memo ignores `inherited`, so a box keeps its containers' old fill after they change
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group, drawn at the `box` rung. The group's `fill` changes from red to blue; the child node object, its pose and its `data` are unchanged. `nodeMemo(node, SLOT, pose, …)` keys on node, pose and `data` only (`nodeMemo` takes an `also` argument for this, which is not passed), so the cached rect with the red fill is returned and the box stays red until something else bumps the memo. It should repaint blue, as the `full` rung does.
- evidence: read (nodeMemo.ts:86-107 compares pose, data and `also`; the fill is computed from `inherited` inside the derive)
- severity: medium

## A group's painter ladder is never read, so a group kind declaring `ladder` always draws in full
- where: packages/core/src/canvas/lod/lodWalk.ts:127 (createLodWalk → pick)
- scenario: a consumer registers a painter for a group kind with a `ladder` (the `LodOptions` doc speaks of "every group with no ladder of its own"). `pick` computes `ladder = ladders && !group ? findNodeShape(…)?.ladder : undefined`, so for any `kind: 'group'` node the ladder is skipped: with no `node.lod` and no `collapseBelowPx` it returns `null` (full), and with `collapseBelowPx` it uses the collapse rungs instead of the painter's. Expected: the group's own ladder wins, with collapse only for groups without one.
- evidence: read
- severity: low

## `byCollapse` caches one ladder per distinct `collapseBelowPx` with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:59,78 (collapseRungs)
- scenario: an app drives `collapseBelowPx` from a continuous control (a slider, or a value derived from zoom or dpr). Every distinct number adds an entry to the module-level `byCollapse` Map, which nothing ever evicts, so it grows for the life of the page.
- evidence: read
- severity: low

## The painted cursor sizes a world-sized glyph from the signed mean scale, so a flipped view draws it wrong or not at all
- where: packages/core/src/canvas/paintedCursorLayer.ts:86 (createPaintedCursorLayer → draw)
- scenario: a view with `scale = { x: 2, y: -2 }` (y-up). `(view.scale.x + view.scale.y) / 2` is 0, so `worldCursorPx` gives 0, and `!(size > 0)` drops the cursor. With `{ x: 1, y: -3 }` the size comes out negative and the cursor also vanishes. `pixelScaleAt` in the same package uses `Math.abs` for each axis; the cursor should do the same.
- evidence: read
- severity: low

## `satisfiesRange` rejects an empty range as unreadable, where npm reads `''` as `*`
- where: packages/core/src/canvas/kitRequirements.ts:131 (satisfiesRange)
- scenario: a contribution declares `requires: { core: '' }`, or a range such as `'1.x || '`. `''.split('||')` gives `['']`, which returns `null`, and `checkRequirements` reports `invalid-range`. The module doc claims npm's everyday grammar, where an empty range matches every version.
- evidence: read
- severity: low

## `fitted` reports the target extent on an axis it could not scale
- where: packages/core/src/canvas/insertPreviewExtent.ts:65-69 (fitted)
- scenario: a `line` preview whose geometry is horizontal (`b.height === 0`) gets a `lands` box with height 20. `sy` falls back to 1, so the geometry only moves and still has zero height, but the result's `bounds` is set to `to` with height 20. The extent the preview, commit and gesture share then disagrees with the geometry it describes.
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

<!-- done: 6 findings, files read: 39 -->
