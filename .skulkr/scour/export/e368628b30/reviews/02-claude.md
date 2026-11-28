## selectionRegion leaves out the copies a selected container draws (copiesFromPose), so the export cuts them off
- where: packages/export/src/selectionRegion.ts:35 (selectionRegion)
- scenario: select a symmetry group (a container with `copiesFromPose`) and export the selection as PNG/SVG/PDF. `boxOf` answers `drawnAabbOf` of the group, which unions its members' boxes but never carries them through the copies (drawnBounds.ts `inkExtentsOf` has no copy step). The region is the original's box only, so every mirrored/rotated copy outside it is cut off. `sceneContentBounds` (core/canvas/contentBounds.ts:38-44) answers the same "what does this draw" question with `copiesWithin` and covers the copies — two answers to one decision.
- evidence: read
- severity: medium
- fix: packages/export/src/selectionRegion.ts (reuse copiesWithin / share a helper with contentBounds.ts)
- size: function
- cause: copies not carried into selection bounds
- confidence: likely

## shownIds recurses into the children of a consumesChildren node on a hidden or annotation layer, which the render walk never paints
- where: packages/export/src/selectionRegion.ts:51 (shownIds)
- scenario: a boolean/compound node (`consumesChildren: true`) sits on a hidden layer (or an annotation layer) and is selected. `shown` replaces it with `doc.childrenOf(id).flatMap(shown)`, so its operands' boxes become the region, though the walk draws neither the node nor its operands (`buildSceneTree` gives a consuming node no children; `sceneContentBounds` contentBounds.ts:33 and `paintedMembers` drawnBounds.ts:108 both return [] here). Expected `null` / "draws nothing"; got a region over undrawn operands, exporting an empty or wrong image. The same "what does a hidden-layer node draw" rule is answered three ways.
- evidence: read
- severity: low
- fix: packages/export/src/selectionRegion.ts
- size: line
- cause: missing consumesChildren check
- confidence: likely

## selectionRegion counts a selected operand of a consumesChildren node at its own box, though it is drawn only as part of its parent's result
- where: packages/export/src/selectionRegion.ts:46 (shownIds)
- scenario: select an operand of a boolean/compound node (reachable by entering it: `enteredGroup.isEnterable` allows consumesChildren). The operand is never painted on its own; `sceneContentBounds` excludes such nodes (`consumed`, contentBounds.ts:36). selectionRegion returns the operand's full drawn box, so an intersect/subtract result exports with a region framing ink that is not there (or a result that draws nothing exports as non-null). Expected: the operand treated like other undrawn nodes (or mapped to its consuming ancestor).
- evidence: read
- severity: low
- fix: packages/export/src/selectionRegion.ts
- size: line
- cause: no consumed-ancestor check
- confidence: likely

## Files read
packages/export/src/captureExport.ts
packages/export/src/exportDiagnostics.ts
packages/export/src/exportFormats.ts
packages/export/src/exportPages.ts
packages/export/src/exportTypes.ts
packages/export/src/index.ts
packages/export/src/placedRects.fixture.ts
packages/export/src/regionPng.ts
packages/export/src/regionRenderArgs.ts
packages/export/src/selectionRegion.ts
packages/export/src/testing/parallaxScene.ts
packages/export/src/testing/plainScene.ts

<!-- done: 3 findings, files read: 12 -->
