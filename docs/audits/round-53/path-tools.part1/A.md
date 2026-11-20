# Findings: path-tools.part1 (round 53)

## linkAnchor drops the whole drag when the link ops come back empty
- where: packages/path-tools/src/constraints/linkAnchor.ts:212 (linkAnchorAction onEnd)
- scenario: an anchor is Alt-dragged and released within reach of another node, so `target` is set. `onEnd` cancels the editAnchors move (`move.onEnd!(endCtx, 'cancel')`) before it has the link ops. `linkOps` then answers `[]` when the dep has no `editOps` (optional on `EditAnchorsDep`) or when `editOps` returns nothing for the snapped path (e.g. the node's own constraints cannot hold at the exact target point though they held at the dragged one). Nothing is committed: the anchor snaps back and the drag is lost, where releasing anywhere else commits it as a plain move. It should build the ops first and fall back to `move.onEnd!(endCtx, reason)` when they are empty, as `replay` falls back to `applyEdit`.
- evidence: read
- severity: medium

## addExtremeAnchors is enabled by an 'xy' test while its run reads params.axes
- where: packages/path-tools/src/extremes/addExtremes.ts:94 (addExtremeAnchorsAction enabled)
- scenario: tune or a last-operation replay gives `{ axes: 'x' }` on a path whose curves turn only in y. `enabled` ignores its params and probes with `'xy'`, so it answers true; `run` adds nothing. The action shows enabled and does nothing. That breaks the rule ruled 2026-11-10: an edit that would change nothing is disabled, by the same test the run takes, as anchorConstraints and setFillets do. `enabled` should take its fourth `params` argument and use `axesOf(params)`.
- evidence: read
- severity: low

## A multi-corner fillet drag or setFillets clamps each corner against its neighbors' old cuts, not their new ones
- where: packages/path-tools/src/fillet/editFillet.ts:76 (withRadius); packages/path-tools/src/fillet/filletCommands.ts:68 (changeCorners)
- scenario: a 100-unit square with two adjacent sharp corners, both selected. Dragging one widget to 80, or `setFillets { radius: 80 }`, gives each corner `min(80, frame.maxTrim)`. `maxTrim` comes from `cornerFrames(origin)` and is "the longest cut the edges allow while the neighbors keep theirs", which is 100 here because the neighbor's cut is 0. Both corners store radius 80 on a shared 100-unit edge (160 > 100). `contourCuts` then scales both cuts down to 50 when drawn. So the stored radii are not what is drawn. The drag no longer follows the pointer (it asks for 80, the corner shows 50). The next `cornerFrames` reports each stored radius above its own `maxTrim` (20). A single-corner drag is clamped to the room it really has. Each target's clamp should use the room left by the other targets' new radii.
- evidence: read (packages/geom/src/paths/corners.ts:69-101 for the scaling and the maxTrim definition)
- severity: low

## Girth's replay re-reads the live view scale where the drag read the press-time one
- where: packages/path-tools/src/girth/girthActions.ts:177 (dragAction replay → gripFor → found)
- scenario: drag a stroke edge at zoom 1, zoom to 4, then change "Grab reach" or "One edge only" in the last-operation panel. `replay` calls `gripFor`, and through `found` it reads `deps.view.get().scale` now. Both the world reach (`pxReach(reachPx, s)`) and the `{ px }` width resolution (`meanScale`) change. The replay can pick another width point, insert an anchor where the drag took an existing one, or find no edge and commit nothing, though the panel only changed a param. `knead` and `linkAnchor` record the scale with the gesture for their replays; girth should keep the press's scale too.
- evidence: read
- severity: low

## Files read
packages/path-tools/src/actionParamSchema.ts
packages/path-tools/src/anchorSelect/anchorSelect.ts
packages/path-tools/src/bridge/bridge.ts
packages/path-tools/src/comb/comb.ts
packages/path-tools/src/constraints/anchorConstraints.ts
packages/path-tools/src/constraints/constraintGlyphs.ts
packages/path-tools/src/constraints/constraintLinkMarks.ts
packages/path-tools/src/constraints/constraintLinks.ts
packages/path-tools/src/constraints/constraintsExtension.ts
packages/path-tools/src/constraints/linkAnchor.ts
packages/path-tools/src/constraints/pathConstraints.ts
packages/path-tools/src/drape/drape.ts
packages/path-tools/src/extremes/addExtremes.ts
packages/path-tools/src/fairing/fairing.tsx
packages/path-tools/src/featurePresets.ts
packages/path-tools/src/fillet/editFillet.ts
packages/path-tools/src/fillet/filletCommands.ts
packages/path-tools/src/fillet/filletControls.ts
packages/path-tools/src/fillet/filletWidgets.ts
packages/path-tools/src/fillet/useFilletControls.ts
packages/path-tools/src/girth/girthActions.ts
packages/path-tools/src/girth/girthOverlay.ts
packages/path-tools/src/girth/index.ts
packages/path-tools/src/girth/useGirthTool.ts
packages/path-tools/src/girth/widthEdit.ts
packages/path-tools/src/groups.ts
packages/path-tools/src/handleLocks/handleLocks.tsx
packages/path-tools/src/handleSnap/handleSnap.ts
packages/path-tools/src/host/createPathEditHost.ts
packages/path-tools/src/host/usePathEditMode.ts
packages/path-tools/src/icons.gen.ts
packages/path-tools/src/icons.table.ts
packages/path-tools/src/index.ts
packages/path-tools/src/kitSettings.ts
packages/path-tools/src/knead/knead.ts
packages/path-tools/src/knead/kneadTargets.ts
packages/path-tools/src/knead/useKneadTool.ts

<!-- done: 4 findings, files read: 37 -->
