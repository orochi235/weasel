# Audit round 45 — core.domains.paths (blind reviewer)

Note: commit 04c3a6536306f9e757e77a6ab15759ff43b02241 is not in this repository's object store
(`git cat-file` reports a bad object). The checkout is at 782733b19c, and `git status` shows no changes
under `packages/core/src/domains/paths`, so these findings were read from that tree.

## Anchor markers come from the form even when the form no longer describes the path, so they are drawn on the wrong anchors
- where: packages/core/src/domains/paths/editablePath.ts:170 (liveAnchorMarkers), against :89 (pathEditPathOf)
- scenario: A node holds `data.representation` (e.g. a spiro form) that no longer matches its `data.path`. This happens when a writer changed the path without dropping the form; the `PathRepresentation` docs plan for that case. `pathEditPathOf` then gets `null` from `editPath` and falls back to the drawn polygon, so path edit shows and edits the raw anchors. `liveAnchorMarkers` never checks this: it returns `representation.anchorMarkers(form)` regardless. The overlay (`usePathEditOverlayLayer` → `anchorMarkerCommands`) then draws the form's marker shapes by flat index onto the drawn path's anchors, whose count and order are different. Some anchors get a spiro marker shape they don't have, and the rest get squares. Markers should be null (squares everywhere) whenever `editPath` returned null, since that is the path being edited.
- evidence: read (spiroRepresentation.editPath returns `spiro && spiroEditPath(path, spiro)`, which can be null)
- severity: medium

## `ownGeometryAt` is typed to take a scene without `get`, then calls `scene.get` and `scene.composition` through a cast
- where: packages/core/src/domains/paths/pathSnap/sceneIndex.ts:54 (createSceneSnapIndexer), reached from packages/core/src/domains/paths/pathSnap/pathSnapSource.ts:60 (ownGeometryAt)
- scenario: `ownGeometryAt` is public (`barrel/editingSeams.ts`) and its `scene` parameter is `Pick<Scene, 'nodes' | 'layers' | 'getVersion'>`. The indexer casts that object to a full `Scene` and calls `nodeFrameOf(scene, node)`. For any mark with a parent and a rect pose, `nodeFrameOf` runs `scenePoseFrame(scene)`, which reads `scene.composition` and calls `scene.get(...)`. A caller that passes exactly the declared fields gets `TypeError: scene.get is not a function` on the first parented node. The declared type should include `get` and `composition`, which the code actually reads.
- evidence: read (poseFrame.ts:81–90 reads `scene.composition` and `scene.get`)
- severity: low

## `createPathLayer`'s dev-warning set grows with every node id that ever mismatched and is never pruned
- where: packages/core/src/domains/paths/pathLayer.ts:92 (createPathLayer, `warned`)
- scenario: In dev, each node whose fill colors, stroke colors or stroke widths have the wrong length adds a `${id}:${nodeKey}:…` key to `warned`. Nothing ever removes one. That includes deleted nodes and `String(idx)` keys for nodes with no id. Over a long session with many mismatched nodes being created and deleted, the set only grows, for as long as the layer lives. It should be bounded or reset to the node ids the current draw sees.
- evidence: read
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

<!-- done: 3 findings, files read: 22 -->
