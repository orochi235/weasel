## The `box` LOD rung memoizes its fill on node and pose only, so an inherited fill goes stale
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark whose `fill` is `'inherit'` (or a group with no background and an inherited fill) is drawn at the `box` rung. Edit the container's fill: the child node object, its `data` and its pose are unchanged, so `nodeMemo(node, SLOT, pose, …)` returns the box filled with the old inherited color. Likewise a ghost painted with a mid-edit `inherited` gets the committed fill, or the reverse. `nodeMemo` takes an `also` argument for exactly this input (the paint a node inherits from its container), and paintLodBox does not pass `inherited` as it.
- evidence: read (nodeMemo.ts:82-105 keys on data, pose, `also`, generation)
- severity: medium

## The pick index never rebuilds when painters or outside geometry change, only when the scene or markers do
- where: packages/core/src/canvas/pickIndex/scenePickIndex.ts:113 (PickIndex.source → changesSince) and :82 (current)
- scenario: a tree is built, then a scene-scoped painter is registered (e.g. a preset installing `nodeShapesOf(scene)` painters after the first pick), or a kind's `geometryGeneration` moves (a face lands). Both bump `nodeMemoGeneration()` / `outsideGeneration()`, which change each node's ink outset and silhouette, hence its broad box. But once `this.tree` exists, `current()` only asks `tree.ensure(false)`, which reads only `source.changesSince`; that wrapper invalidates for `markerGeneration` alone. The settle key that includes `nodeMemoGeneration` and `outsideGeneration` is consulted only when there is no tree. So the old, smaller boxes stay, and `candidates` drops nodes the point query would now hit: a click on the newly-wider stroke misses.
- evidence: read (reachTree.ts:60-64: ensure consults only changesSince)
- severity: medium

## `resetNodeShapesForTests` leaves the memoized evaluation order serving the painters it removed
- where: packages/core/src/canvas/nodeShapeRegistry.ts:113 (resetNodeShapesForTests)
- scenario: a test registers a painter on `defaultNodeShapes`, a lookup caches `evaluationOrder` under the current `nodeMemoGeneration`, then the test calls `resetNodeShapesForTests()`. The reset empties the tiers and the built-ins but never calls `nodeShapesChanged()`, so the generation is unchanged and `evaluationOrder` (keyed on it) returns the pre-reset list, still holding the removed painter and its released generation hold; scoped registries' cached orders are equally stale. The next test sees a painter it never registered until something unrelated bumps the generation.
- evidence: read
- severity: low

## `fitted` reports the target extent on an axis the geometry has none on
- where: packages/core/src/canvas/insertPreviewExtent.ts:68 (fitted)
- scenario: a `line` preview that is horizontal (`b.height === 0`) with `lands` of height 20. `sy` is 1, so the geometry only moves and stays zero-height, as the doc says ("An axis it has no extent on only moves"), yet the returned `bounds` is `to` verbatim, height 20. The extent's own contract is "World-space AABB of `geometry`", so the gesture's reported bounds and the preview/commit geometry disagree.
- evidence: read
- severity: low

## `clipboardFault` names the wrong item when a parent chain runs into a loop it is not part of
- where: packages/core/src/canvas/pasteShape.ts:44 (clipboardFault)
- scenario: items `a.parent = b`, `b.parent = c`, `c.parent = b`. Starting from `a`, the walk meets `b` again and returns `item "a" is its own ancestor`; `a` is not its own ancestor, `b` and `c` are. The paste is still refused, but the message points the user at an innocent item. It should name `at` (the repeated id).
- evidence: read
- severity: low

## The collapse ladder cache is keyed on a consumer number with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:58 (byCollapse / collapseRungs)
- scenario: a view whose `collapseBelowPx` is driven by a slider or derived from zoom (any non-constant float) adds a `Resolved` entry to the module-level `byCollapse` Map for every distinct value, never evicted, for the life of the page.
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
