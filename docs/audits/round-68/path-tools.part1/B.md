# Audit round 68 — path-tools.part1

## addExtremeAnchors replaces the anchor selection even when the commit is refused
- where: packages/path-tools/src/extremes/addExtremes.ts:87-88 (addExtremeAnchorsAction.invoker.run)
- scenario: the open path has constraints that the split cannot satisfy, so an extension's `finishEdit` returns null and `commitAnchorEdit` returns false without committing anything. The `edit` callback has already run on the scratch decode, though, so `next` holds the indices of the split set: the kept anchors renumbered past the inserted ones, plus the new anchors. `run` ignores `commitAnchorEdit`'s result and calls `dep.setSelectedAnchors(next)`. The path stays unsplit, but the selection now names shifted anchors and indices beyond the path's anchor count. It should change the selection only when the commit lands, as `bridgeAnchors` does (`if (commitAnchorEdit(...)) dep.setSelectedAnchors([])`).
- evidence: read (commitAnchorFrame returns false when `finishPathEditFrame` is null, anchorEditing.ts:67-75)
- severity: medium

## linkAnchor's reach accepts Infinity, so a drop links to an anchor anywhere on the canvas
- where: packages/path-tools/src/constraints/linkAnchor.ts:52-53 (reachOf)
- scenario: params `{ reachPx: Infinity }`, from `<SceneCanvas tune>` or a binding's params, pass `typeof === 'number' && > 0`. `linkTargetAt` then gets `reach = Infinity`, `landingOn` accepts every anchor (`d <= Infinity`), and a plain Alt-drag snaps the anchor onto the nearest anchor of the topmost other node, however far away, and ties it there. Every other numeric param in this area goes through `isFiniteNumber` (bridge's tension, knead, anchorSelect's n); this one should too, and fall back to the default.
- evidence: read
- severity: low

## girth.drag's reach accepts Infinity, so a press grabs a stroke edge anywhere
- where: packages/path-tools/src/girth/girthActions.ts:107-111 (reachOf)
- scenario: `reachPx: Infinity` passes `!(params.reachPx > 0)`. It is used as the reach (`pxReach(Infinity)`), so `widthEdgeAt` accepts any edge (`Math.abs(gap) <= Infinity`) and every anchor along the path. The press then grabs the topmost stroke from anywhere on the canvas. It is also stored through `noteReach`, so later hovers and clears reach infinitely too. This is the same check `linkAnchor` gets wrong, and it needs the same finite test.
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
packages/path-tools/src/fillet/cornerRadii.ts
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

<!-- done: 3 findings, files read: 37 -->
