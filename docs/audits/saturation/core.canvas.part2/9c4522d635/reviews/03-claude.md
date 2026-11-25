## A scene layer's LOD record outlives the layer's walks, so stale picks answer `rungOf`/`skips` for nodes the view no longer draws that way
- where: packages/core/src/canvas/lod/lodState.ts:42 (createLodState `find`, `begin`/`end`)
- scenario: `buildSceneLayer` begins one walk per painted scene layer, keyed `slot.forLayer`. A layer that stops being walked (hidden, removed, or the scene slot switching between split `scene:<id>` keys and the unsplit `'scene'` key) never calls `begin`/`end` under its key again, so its map stays in `walks` forever. `find` searches every map in insertion order, so a node moved from that layer to a still-walked one returns the stale pick first: a node recorded at `'none'` (or a group recorded with `skip: true`) stays unpickable / collapses its children for `pickWalk` (`lod.rungOf(id) === 'none'`, `lod.collapsedAbove`) even though this frame drew it in full. `size()` also breaks its documented bound ("at most what the walks of the last frame visited"). Expected: a key not walked in a frame drops its map, or lookups prefer the walk that last visited the node.
- evidence: read (lodState.ts; callers in buildSceneLayer.ts:238–241 key by `slot?.forLayer ?? 'scene'`)
- severity: low

## `byCollapse` caches one resolved ladder per distinct `collapseBelowPx` value with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:58 (`byCollapse`, `collapseRungs`)
- scenario: a consumer driving `LodOptions.collapseBelowPx` from a continuous control (a slider, a value derived from dpr or zoom) creates a new module-level `Map` entry for every distinct number it ever passes; nothing evicts them. Expected: a bounded (e.g. last-N or single-slot) memo.
- evidence: read
- severity: low

## `fitted` reports the landing box as the extent on an axis the geometry has no extent on, while leaving the geometry zero-width there
- where: packages/core/src/canvas/insertPreviewExtent.ts:66 (`fitted`)
- scenario: a vertical line insert (`a.x === b.x`, bounds width 0) with `lands = { x: 10, y: 0, width: 20, height: 50 }`: `sx = 1`, the line is moved to x = 10, but the returned `bounds` is `{ x: 10, width: 20, … }`. The module's contract is that `bounds` is "World-space AABB of `geometry`" and the one answer shared by preview, commit and the gesture's reported bounds; here the reported bounds are 20 wide while the painted/committed line is 0 wide. Expected: `bounds` recomputed from the moved geometry (width 0 on that axis), or the zero axis centered/stretched consistently.
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
