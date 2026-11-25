# Audit round 45 — core.domains.paths

## Anchor markers come from a form that path edit is not showing
- where: packages/core/src/domains/paths/editablePath.ts:170 (liveAnchorMarkers)
- scenario: a node carries `data.representation` of a kind an extension reads (e.g. path-tools' spiro), but its `data.path` was rewritten by a writer that kept the form, so `representation.editPath(path, form)` returns null. `pathEditPathOf` (line 95) then falls back to the drawn path and path edit shows and edits that path's anchors. `liveAnchorMarkers` never asks `editPath`: it returns `anchorMarkers(form)` regardless, so the overlay (`anchorMarkerCommands`, indexed by flat index) paints the spiro point kinds' markers onto the drawn path's unrelated anchors. It also gives a marker array of the wrong length. It should return null whenever `pathEditPathOf` would fall back to the drawn path, so the two halves answer "is the form in use" the same way.
- evidence: read
- severity: medium

## Inserting an anchor between two unset widths bakes the stroke's current width into it
- where: packages/core/src/domains/paths/anchorData.ts:39 (carryWidths)
- scenario: a stroke has `width: 4` and `vertexWidths: [NaN, NaN, 6]`, where NaN means the anchor follows `stroke.width`. Inserting an anchor on the segment between anchors 0 and 1 gives an origin with `t ≠ 0, b ≠ a`. `vertexHalfWidths(NaN, 4)` gives `{2, 2}` for both ends, so the new entry is `vertexWidthFromSides(2, 2) = 4`, a set width. Setting `stroke.width` to 10 later widens anchors 0 and 1 but leaves the inserted one at 4: the stroke pinches there. The doc says "Unset stays NaN". The entry should stay NaN when both ends are unset, or at least where each blended side reads only the fallback.
- evidence: read (paint/src/vertexWidth.ts vertexHalfWidths, vertexWidthFromSides)
- severity: medium

## pathNode drops `place.pose.transform`
- where: packages/core/src/domains/paths/pathNode.ts:50 (pathNode)
- scenario: `pathNode('a', d, {}, { pose: { x: 0, y: 0, width: 10, height: 10, transform: [1, 0, 0.5, 1] } })` builds a pose of `{ x, y, width, height }`, plus `rotation` when one is set. `PathNodePlacement.pose` is a `RectPose`, which carries `transform?: PoseLinear` (core/geometry/rectPose.ts:16), and that is silently dropped, so the node draws unskewed. The placement's pose should keep its `transform`.
- evidence: read
- severity: low

## The snap index reads `scene.get` and `scene.composition`, which its declared scene type does not include
- where: packages/core/src/domains/paths/pathSnap/sceneIndex.ts:54 (createSceneSnapIndexer); same type on ownGeometryAt, pathSnapSource.ts:61
- scenario: `SnapScene` is `Pick<Scene, 'nodes' | 'layers' | 'getVersion'>`, but every node goes through `nodeFrameOf(scene as Scene, node)`. For a node with a parent and a rect pose, that calls `scenePoseFrame`, which reads `scene.composition` and `scene.get`. A caller passing exactly what the type asks for, as the package's own tests do (pathSnapSource.test.ts `sceneOf`), throws `scene.get is not a function` as soon as one rect node sits under a container. The type should include `get` and `composition`, or the frame should come from what it declares. It also builds a fresh `scenePoseFrame` per node in the loop.
- evidence: read (interactions/actions/poseFrame.ts:80)
- severity: low

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
