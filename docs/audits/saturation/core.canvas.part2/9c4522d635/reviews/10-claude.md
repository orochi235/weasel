## A `box` LOD rung keeps a stale inherited fill after the container's paint changes
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group drawn at the `box` rung. The group's `fill` is edited. The child's node object and pose are unchanged, so `nodeMemo(node, SLOT, pose, …)` returns the commands built with the old `inherited` fill. The box keeps showing the old color until the child itself is edited or the memo generation moves. `nodeMemo` takes an `also` argument for exactly this kind of outside input (its doc names inherited paint), but `paintLodBox` never passes `inherited`.
- evidence: read (nodeMemo.ts:82-105 keys on data, pose, `also`, generation only)
- severity: medium

## A group never reads a painter's `ladder`: groups only ever get `collapseBelowPx` rungs
- where: packages/core/src/canvas/lod/lodWalk.ts:127 (createLodWalk pick)
- scenario: a painter registered for a group kind declares `ladder`. `ladder = ladders && !group ? findNodeShape(...)?.ladder : undefined` drops it, so the group draws `full` at every size. With `collapseBelowPx` set it gets the collapse rungs instead. `LodOptions.collapseBelowPx` says it applies to "every group with no ladder of its own", which implies a group's own ladder should win. A group's `node.lod` naming one of its painter's rungs also falls back to `full`, because `nodeLodRungs(own, undefined)` is never given the ladder.
- evidence: read (inference from the doc comment, not run)
- severity: low

## `byCollapse` caches one ladder per distinct `collapseBelowPx` value, with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:61,76 (collapseRungs)
- scenario: a consumer drives `collapseBelowPx` from a slider or a continuous setting. Every distinct float adds an entry to a module-level `Map<number, Resolved>` that is never pruned, so memory grows for the life of the page.
- evidence: read
- severity: low

## `fitted` reports `to`'s full extent on an axis the geometry has none on
- where: packages/core/src/canvas/insertPreviewExtent.ts:68-70 (fitted)
- scenario: a horizontal line or a one-point pencil (`b.height === 0`) has a `lands` box with a nonzero height. `sy = 1` only moves the geometry, which keeps zero height at `to.y`. But `bounds` is set to `to` whole, so the extent claims `to.height`. `InsertPreviewExtent.bounds` is documented as "World-space AABB of `geometry`", so the preview, the commit and the gesture's reported bounds disagree with the geometry they draw.
- evidence: read
- severity: low

## An empty `requires` range is reported `invalid-range`, where npm reads it as `*`
- where: packages/core/src/canvas/kitRequirements.ts:131 (satisfiesRange)
- scenario: `requires: { core: '' }` (npm's "any version") splits to one empty alternative and returns `null`, so `checkRequirements` reports `invalid-range` for a requirement every version meets. The module says it reads npm's everyday grammar.
- evidence: read
- severity: low

## `resetNodeShapesForTests` does not move the memo generation, so `evaluationOrder` serves its cached list of released registrations
- where: packages/core/src/canvas/nodeShapeRegistry.ts:106-115 (resetNodeShapesForTests)
- scenario: a test registers painters, then resets. The `orders` cache is keyed on `nodeMemoGeneration()`, which the reset never bumps (unlike `nodeShapesChanged`). The next `evaluationOrder(defaultNodeShapes)` returns the pre-reset list, including painters the reset released, unless the re-run of `registerBuiltIns` happens to bump the generation itself.
- evidence: read (whether the built-in registration bumps it was not checked)
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
