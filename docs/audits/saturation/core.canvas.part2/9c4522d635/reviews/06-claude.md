## The `box` rung memoizes its fill without the inherited paint, so an inheriting node keeps a stale color
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` under a group whose `fill` is red is zoomed out to its `box` rung. Its container's fill is edited to blue. The child node object, its data and its pose are unchanged, so `nodeMemo(node, SLOT, pose, …)` hits (its key is node, slot, pose and data) and returns the red rect. `inherited` is read inside the derive but never passed as `nodeMemo`'s `also` argument. The box should repaint blue; it stays red until the child itself is edited or the memo generation moves. The same applies to a group's box filled from its own `fill: 'inherit'`.
- evidence: read (nodeMemo.ts:86–106 keys on pose, data and `also` only)
- severity: medium

## `LodState` keeps the map of a walk key that is no longer walked, and `rungOf`/`skips` read it ahead of the current one
- where: packages/core/src/canvas/lod/lodState.ts:41 (createLodState `find`) and :62 (`begin`/`end`)
- scenario: a key's map is replaced only when a walk under that same key ends. Suppose a scene layer `a` is hidden or removed, so nothing walks under `scene:a` again, and a node it drew at `none` (or a collapsed group at `box`) moves to layer `b`. `find` scans `walks` in insertion order and returns the stale `a` pick before `b`'s. Picking then skips the node as `'none'`, or treats it as collapsed, even though `b` now draws it in full. `size()` also breaks its "at most what the walks of the last frame visited" contract. A key that no longer gets walked should be dropped, or the lookup should prefer the current frame's walks.
- evidence: read
- severity: low

## `collapsedAbove` returns the outermost collapsed ancestor, but its contract says the nearest
- where: packages/core/src/canvas/lod/lodState.ts:47 (collapsedAbove) vs its doc at :17
- scenario: the ancestors are collapsed groups G1 (inner) and G2 (outer). The interface says the result is "the nearest of `ancestors` (innermost first)", so G1. The loop runs from the end and returns G2. pickWalk only compares the result to null, but any caller that uses the id (for example to pick the collapsed group the pointer is on) gets a different group from the one the documentation promises. The contract and the code answer the question in two different ways.
- evidence: read
- severity: low

## `byCollapse` is a module-level cache keyed by every `collapseBelowPx` value ever used, with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:62 and :80 (collapseRungs)
- scenario: a consumer drives `LodOptions.collapseBelowPx` from a continuous control (a slider, or a value derived from the dpr or the zoom). Every distinct number adds a `Resolved` entry to a module-level `Map` that is never pruned, so it grows for the life of the page. Every other ladder cache in this file is a `createPart`/WeakMap keyed by an object.
- evidence: read
- severity: low

## `fitted` reports `bounds` the full `lands` box on an axis where the geometry still has no extent
- where: packages/core/src/canvas/insertPreviewExtent.ts:64 (fitted)
- scenario: a horizontal line preview (`a.y === b.y`, extent height 0) gets a `lands` box 40 high. `sy` is 1, so the line only moves to `to.y`, but the result's `bounds` is `{ …, height: 40 }`. `InsertPreviewExtent.bounds` is documented as the AABB of `geometry`, so the gesture's reported bounds and the commit's extent claim 40 px of height that the painted geometry does not have.
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
