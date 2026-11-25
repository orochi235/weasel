# Audit round 60 — core.canvas.part2 findings

Note: the brief names commit deaf03bd8ed407174fa289a1262d2699ffbe97db, which is not in this clone; the tree read is HEAD 6f634fabe1 (listed files clean in the working tree).

## geometryGenerationOf can return a value it returned before, so a cache keyed on it alone serves stale outlines
- where: packages/core/src/canvas/nodeOutline.ts:83 (geometryGenerationOf)
- scenario: the sum runs over the painters currently in `shapes`. Unregister a painter whose `geometryGeneration()` is 3 (sum drops by 3), then let another kind's face land three times (sum climbs by 3): the public function answers the same number as before both changes, so a consumer cache keyed on it (as its doc invites) keeps outlines built against the old painter set and old glyphs. Core's own `pathSnap/sceneIndex` survives only because it also keys on `nodeMemoGeneration`.
- evidence: read
- severity: low

## reportCommandLosses never reports a group effect whose shader program has no GLSL source
- where: packages/core/src/canvas/renderDiagnostics.ts:73 (shaderPrograms)
- scenario: a scene whose drawn commands include `{ kind: 'group', effects: [{ program: blurHandle }], children }` where `blurHandle` was registered with WGSL only. `shaderPrograms` collects `c.program.id` from `kind: 'shader'` commands and recurses into group children, but never reads `c.effects[i].program`, so the headless WebGL2 render drops that pass and the diagnostics sink hears nothing — the "shader" diagnostic the doc promises for "each shader program with no GLSL source" is missing for every effect program.
- evidence: read (`GroupDrawCommand.effects: readonly Effect[]`, `Effect.program: ShaderProgramHandle` in packages/renderer/src/effects/types.ts)
- severity: medium

## RasterSession.renderIds drops the plan's `screen` at a pixelRatio other than 1, so its ids disagree with `render`'s pixels
- where: packages/core/src/canvas/renderSceneToPixels.ts:320 (createRasterSession → renderIds)
- scenario: `session.renderIds({ scene, sourceRect, scale: {x:2,y:2}, pixelRatio: 2 })` on a scene with a `'screen'`-unit paint or a `{ px }` stroke measured in screen space. `render` passes `screen: args.screen ?? plan.screen` (line 307), where `plan.screen` is `scale(ratio)`; `renderIds` passes `screen: args.screen` alone, so with no explicit `screen` the id frame measures screen units in output pixels while the raster measured them in CSS pixels (×2). The two answers of "the same render" differ: a coverage mask from `idMask` misses or overshoots what `render` painted. Should be `args.screen ?? plan.screen`.
- evidence: read
- severity: medium

## A paste landing on a page keeps the copied node's layer, where an insert onto the same page takes the page's layer
- where: packages/core/src/canvas/sceneClipboard.ts:283 (pasteSceneSnapshot)
- scenario: a paged scene whose page nodes sit on layer `pages`, with nothing entered (`landing` absent, so `into === null` and `pagedLandings` places the roots). Copy a node from layer `notes` and paste: `pasteOnPages` returns `site = siteIn(scene, pageNode)`, whose `layer` is the page's, and the root is parented to the page — but line 283 sets `layer` from `into` only, so the pasted root stays on `notes`. Drawing the same shape there with an insert tool lands it on `pages` (`siteIn` → `parent.layer`). The one question "which layer does a node placed on a page take" gets two answers; the pasted child then draws and hides with a different layer than its page siblings. Worse, when the copied layer is *below* the page's layer, the scene refuses the insert outright ("a child may not render below its parent's layer", packages/core/src/core/scene/layerStack.ts:93), so the paste throws instead of landing. The layer should come from the landing site whenever one places the root (`landing(item)?.layer`).
- evidence: read (siteIn at packages/core/src/canvas/deps/insertSite.ts:28; layer floor at core/scene/layerStack.ts:73–93)
- severity: medium

## A node moved into an already-wide container without its box changing is never added to that container's child BVH, so it is culled from the render and dropped from the pick index
- where: packages/core/src/canvas/reach/reachBoxes.ts:77 (ReachBoxes.drain), with packages/core/src/canvas/reach/reachTree.ts:104 (Tree.apply)
- scenario: a scene with ≥512 nodes (so `sceneSubtreeCull` prunes) where group G already has ≥64 children (`rec.wide` set). Move node N into G so that its world box is unchanged — an absolute-pose scene (`scene.move(N, G)` never touches the pose), or a world-preserving reparent under a translate-only frame. `apply` removes N from its old parent's `WideChildren` (`rec.parent.wide?.drop(rec)`) and points `rec.parent` at G, but the only call that inserts a record into a `WideChildren` is `rec.parent.wide?.put(rec)` in `drain`, which runs only when `recompute(rec)` reports the reach moved. Same box, same tags → `recompute` answers false → `continue`, and G's `fitWide` only marks ranks stale (it reloads only when `rec.wide === null`). From then on `childrenMeeting(G, …)` asks `G.wide.meeting`, which never yields N: whenever G is not wholly inside the view (the `boxWithin` shortcut), N is not painted (`sceneVisibility`) and cannot be clicked or marquee'd through the pick index (`scenePickIndex.collect`), until something rebuilds the tree. Every record whose parent changed should be `put` into the new parent's wide index regardless of whether its reach moved.
- evidence: read (traced `apply` → `drain` → `recompute` → `fitWide`; `WideChildren.load` is reached only from `fitWide` when `rec.wide === null`). Not run; the property test in sceneVisibility.test.ts moves nodes with `scene.move` in a composing scene, where the world box changes and `put` does run.
- severity: high

## The render visibility index keeps one set of reach trees per `paintBounds` / `toPose` function identity, with no bound
- where: packages/core/src/canvas/reach/sceneVisibility.ts:147 (visibilityOf)
- scenario: `<SceneCanvas layers={{ scene: { paintBounds: (node, pose, view) => … } }}>` written inline, on a scene of ≥512 nodes. `sceneSlotWiring` hands `slot.paintBounds` straight to `sceneSubtreeCull`, and `visibilityOf` keys a strong `Map` (inside the per-scene part) on that function, then on `toPose`. Every render that rebuilds the slot makes a new function, so a new `SceneVisibility` is added — each holding up to `OCTAVES_KEPT` trees with a record, a slab slot and BVH entries per node — and the old ones are never evicted for the scene's lifetime. Memory grows with every re-render, and each new identity also cold-builds the whole tree on its first frame. `OCTAVES_KEPT` bounds trees per index, but nothing bounds the indexes.
- evidence: read
- severity: medium

## A copy whose transform carries a child reach to a non-finite box is unioned in as the box at the origin instead of as unbounded
- where: packages/core/src/canvas/reach/boxes2d.ts:43 (affineImage), read by packages/core/src/canvas/reach/reachBoxes.ts:154 (ReachBoxes.recompute)
- scenario: a group whose `copiesFromPose` returns an affine that overflows a child's box (e.g. scale 1e305 on a box near 1e4, or a NaN entry from a degenerate pose). `writeImage` answers `BOX_ALL` and leaves `out` unwritten, but `affineImage` drops that answer, and `recompute` hands the fresh zero-filled `out` to `unionInto` as `BOX_SOME`. The container's reach is then its own box grown to take in `(0,0)`, not `BOX_ALL`, so a view away from the origin prunes the container's children (render) or skips them (pick index) though a copy paints there. `writeBounds` handles the same case by returning `BOX_ALL`; the image path should do likewise.
- evidence: read
- severity: low

## Files read
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
packages/core/src/canvas/pressTarget.ts
packages/core/src/canvas/publishPreviews.ts
packages/core/src/canvas/rasterReadback.ts
packages/core/src/canvas/rasterToPng.ts
packages/core/src/canvas/reach/boxes2d.ts
packages/core/src/canvas/reach/reachBoxes.ts
packages/core/src/canvas/reach/reachRec.ts
packages/core/src/canvas/reach/reachRegion.ts
packages/core/src/canvas/reach/reachTree.ts
packages/core/src/canvas/reach/reachTypes.ts
packages/core/src/canvas/reach/sceneVisibility.ts
packages/core/src/canvas/reach/wideChildren.ts
packages/core/src/canvas/readCanvasPixels.ts
packages/core/src/canvas/readback.ts
packages/core/src/canvas/registerShaders.ts
packages/core/src/canvas/renderDebugSnapshot.ts
packages/core/src/canvas/renderDiagnostics.ts
packages/core/src/canvas/renderNeeds.ts
packages/core/src/canvas/renderSceneToPixels.ts
packages/core/src/canvas/renderSceneToPixelsTypes.ts
packages/core/src/canvas/sceneAdapter.ts
packages/core/src/canvas/sceneClipboard.ts
packages/core/src/canvas/sceneLayerPaint.ts
packages/core/src/canvas/scenePickIds.ts
packages/core/src/canvas/scenePickReads.ts
packages/core/src/canvas/scenePickSource.ts

<!-- done: 7 findings, files read: 50 -->
