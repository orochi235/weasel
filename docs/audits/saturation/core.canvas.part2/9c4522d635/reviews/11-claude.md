## The `box` LOD rung memoizes its fill without the inherited paint it reads
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` drawn at the `box` rung. `nodeMemo(node, SLOT, pose, …)` keys only on the node, its pose and its data (no `also`), but `boxFillOf` reads `inherited`. Change the parent group's fill: the child node object, pose and data are unchanged, so the memo returns the box filled in the old inherited color. The same applies when one node is drawn with two different `ctx.inherited` (a ghost whose containers are mid-edit, versus the document): whichever painted first wins. Should pass `inherited` (or its fill) as the memo's `also`.
- evidence: read (nodeMemo.ts:105 compares pose, data, also only)
- severity: medium

## Collapse-rung cache grows without bound, keyed on `collapseBelowPx`
- where: packages/core/src/canvas/lod/lodWalk.ts:59,78 (byCollapse, collapseRungs)
- scenario: a view whose `collapseBelowPx` is driven by a slider or derived from a continuous value (zoom, dpr) produces a new float per frame; each one adds an entry to the module-level `byCollapse` Map, which is never pruned for the life of the process.
- evidence: read
- severity: low

## A group's painter ladder is never consulted
- where: packages/core/src/canvas/lod/lodWalk.ts:128 (createLodWalk pick)
- scenario: `ladder = ladders && !group ? findNodeShape(...)?.ladder : undefined`. A painter registered for a group kind with `ladder` set never gets its rungs used, and a group's own `node.lod` naming one of that painter's rungs resolves through `nodeLodRungs(own, undefined)` and draws `full` instead. `LodOptions.collapseBelowPx` says it applies to "every group with no ladder of its own", implying groups can have one.
- evidence: read (inference on intent)
- severity: low

## `resetNodeShapesForTests` leaves `evaluationOrder`'s cache serving the pre-reset painters
- where: packages/core/src/canvas/nodeShapeRegistry.ts:105 (resetNodeShapesForTests); also addBuiltInShape:100
- scenario: reset empties the tier arrays but bumps no generation, and `orders` caches spread copies keyed by `nodeMemoGeneration()`. The next `evaluationOrder(defaultNodeShapes)` returns the cached list still holding every released high/normal painter and the old built-ins, while `ensureBuiltInShapes` pushes a second set of built-ins nothing reads. The same staleness hits any order cached before `setBuiltInShapes` is called, since `addBuiltInShape` never calls `nodeShapesChanged`.
- evidence: read
- severity: low

## `fitted` reports landing bounds the fitted geometry does not have on a zero-extent axis
- where: packages/core/src/canvas/insertPreviewExtent.ts:62 (fitted)
- scenario: a horizontal line preview (height 0) with `lands` of height 10: `sy = 1`, the line is moved to `y = to.y` (the top edge, not centered), but `bounds` is set to `to` whole, height 10. `InsertPreviewExtent.bounds` is documented as the AABB of `geometry`, so the preview, the commit and the reported gesture bounds disagree by the landing box's extent on that axis.
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
