# Audit round 42 — core.domains.paths

## pathNode drops a `place.pose`'s `transform` (skew / per-axis scale)
- where: packages/core/src/domains/paths/pathNode.ts:44-50 (pathNode)
- scenario: `pathNode('a', d, {}, { pose: { x: 0, y: 0, width: 100, height: 50, transform: { a: 1, b: 0, c: 0.5, d: 1 } } })` → the spec's pose is rebuilt from `x, y, width, height` and `rotation` only, so the node is drawn unskewed. `RectPose.transform` is a documented field of the `pose` type the placement takes; it should be carried as `rotation` is.
- evidence: read
- severity: medium

## anchorIndexUnder measures its screen-pixel reach as a world circle, so a view that scales its axes apart reaches far past `reachPx` on one axis
- where: packages/core/src/domains/paths/anchorUnder.ts:18-28 (anchorIndexUnder)
- scenario: view scale `{ x: 1, y: 10 }`, reach 10 px. `pxReach` gives the larger per-axis extent, 10 world units, and the test is a world-space circle of that radius. An anchor at (0, 0) and a click at world (0, 9) — 90 screen px below it — reports the anchor as clicked (`editAnchors.anchorUnder`, used by the click-in-path-edit paths, text-tools' anchor clicks). The test should compare on screen (`withinPxRadius(dx, dy, reachPx, scale)`), as geom's `pxReach` doc asks "where the comparison can stay on screen" and as every path-tools hit test (penTargets, spiroInsertPoint, useSpiroTool, slicePendingCut) already does; the anchors the overlay draws are `anchorSizePx` squares on screen.
- evidence: read (geom/src/pxExtent.ts:45-52 pxReach)
- severity: low

## The path-edit overlay draws a node's anchors at its stored pose, not its effective one, so a derived or overridden node's anchors sit off its drawn outline
- where: packages/core/src/domains/paths/editablePath.ts:141-142 (previewedShape), used by liveEditablePath / usePathEdit.ts:73-77 (getPose)
- scenario: with no in-flight preview naming the id, `previewedShape` falls back to `node.pose` — the authored pose of the committed node (`nodeOf` is `scene.get`, useSceneCanvasLayers.ts:147). The renderer and `resolvePreviews` (resolvePreviews.ts:89) fall back to `effectivePose(scene, node)`, which applies the scene's pose override and the node's derived pose (effectivePose.ts:305-315; "Every pose a reader acts on comes from here"; `GesturePreviewSource.previewPose`'s doc: "Absent/null falls back to the node's effective pose, which is where a transform publishing to the scene's overrides puts it"). So a path node whose pose derives (dependsOn / a derived pose) or carries an override (an animator, a transform that publishes overrides) is drawn at one place while path edit paints its outline and anchor markers — and the extensions' marks, which read the same path — at another; the anchors a user grabs are not on the shape.
- evidence: read
- severity: medium

## The path-snap index snaps to each node at its stored pose, not the pose it is drawn at
- where: packages/core/src/domains/paths/pathSnap/sceneIndex.ts:54 (createSceneSnapIndexer)
- scenario: each leaf's snap geometry is built from `shownIn(nodeFrameOf(scene, node), node).pose`, i.e. `node.pose` carried through its container frame. A node whose pose is derived (or overridden — the cache is keyed on `scene.getVersion()` and painter generations only, so an override change would not even rebuild it) draws at `effectivePose(scene, node)`, so its anchors, midpoints, intersections etc. are offered where the node is not drawn. Should read the effective pose, as hit-testing and drawing do.
- evidence: read
- severity: medium

## Files read
packages/core/src/domains/paths/anchorData.ts
packages/core/src/domains/paths/anchorMarkers.ts
packages/core/src/domains/paths/anchorUnder.ts
packages/core/src/domains/paths/editablePath.ts
packages/core/src/domains/paths/index.ts
packages/core/src/domains/paths/nodeFrame.ts
packages/core/src/domains/paths/originProjection.ts
packages/core/src/domains/paths/pathEditExtension.ts
packages/core/src/domains/paths/pathEditState.ts
packages/core/src/domains/paths/pathEditingOverlayLayer.ts
packages/core/src/domains/paths/pathLayer.ts
packages/core/src/domains/paths/pathNode.ts
packages/core/src/domains/paths/pathRepresentation.ts
packages/core/src/domains/paths/pathSnap/glyphs.ts
packages/core/src/domains/paths/pathSnap/pathSnapSource.ts
packages/core/src/domains/paths/pathSnap/sceneIndex.ts
packages/core/src/domains/paths/pathSnap/snapGeometry.ts
packages/core/src/domains/paths/shapeGenerator.ts
packages/core/src/domains/paths/strokeOutline.ts
packages/core/src/domains/paths/strokeRegion.ts
packages/core/src/domains/paths/useAnchorFields.ts
packages/core/src/domains/paths/usePathEdit.ts

<!-- done: 4 findings, files read: 22 -->
