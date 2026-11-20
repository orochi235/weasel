# Findings: path-tools.part1

## addExtremeAnchors is enabled by an 'xy' check whatever axis its params name
- where: packages/path-tools/src/extremes/addExtremes.ts:91 (addExtremeAnchorsAction.enabled)
- scenario: a binding or bar entry tuned with `{ axes: 'x' }` on a path whose curved segments only turn in y (e.g. a single arc bulging up). `enabled` ignores its params and asks `addExtremesTo(..., 'xy')`, which finds the y extreme and answers true; `run` then uses `axesOf(params)` = 'x', adds nothing, and the command shows enabled but does nothing. The opposite never happens, but the button lies. `enabled` receives params as its fourth argument (as `constraintCommand` in anchorConstraints.ts uses), so it should pass `axesOf(params)` — the ruled 2026-11-10 "an edit that would change nothing is disabled" applies.
- evidence: read
- severity: low

## A path-edit host given a `target` never tells subscribers when the open path moves from one node to another
- where: packages/path-tools/src/host/createPathEditHost.ts:72 (createPathEditHost, setEditingId)
- scenario: `createPathEditHost({ modes, target })`, path `a` open (registry in `path-edit`), then `setEditingId('b')`. The target branch calls `target.open('b')` and returns without `changed.emit()`. The registry is already in `path-edit`, and `ModeRegistry.setMode` returns early when the mode is unchanged (packages/modes/src/registry.ts:48, no bump), so nothing reaches `subscribe` listeners: `<SceneCanvas pathEdit>` does not repaint and `useFilletControls` keeps showing `a`'s corners while `editingId()` already answers `b`. The non-target branch handles exactly this case (`if (modes?.current().id === was) changed.emit()`); the target branch has no equivalent, and `PathEditModeTarget` offers no subscription of its own. With `target` and no `modes`, no change is ever announced.
- evidence: read
- severity: medium

## The fillet widget draws a sharp corner as `'round'` whatever shape `editFillet`'s params give it
- where: packages/path-tools/src/fillet/filletWidgets.ts:97 (filletWidgetCommands)
- scenario: `editFillet` tuned with `{ shape: 'bevel' }` (its own `EDIT_FILLET_PARAMS` form, or `<SceneCanvas tune>`). On a sharp corner the widget glyph is cut with `cornerShapeK('round')`, a hard-coded literal, while dragging it gives the corner `newShapeOf(params)` = bevel (editFillet.ts:53). The doc above the function promises "a corner with no spec draws as round, the shape a drag gives it", which holds only for the default. The default shape is answered in two places as well: the literal `'round'` here, and `DEFAULT_FILLET_SHAPE` in editFillet.ts, which this file does not import.
- evidence: read
- severity: low

## `constrainAnchors` and `unconstrainAnchors` carry the `path-drag` tag though they are immediate commands
- where: packages/path-tools/src/constraints/anchorConstraints.ts:141 (constraintCommand)
- scenario: both are built with `pathOperationTags('drag')`, which is documented as "A drag on a path's own anchors, handles, or segments, in path edit" (packages/core/src/interactions/actions/pathGestureTags.ts:10). They have `timing: 'immediate'` and no drag binding. Every other selection command here (bridge, addExtremes, anchorSelect, fillet commands) use `'command'`. `actionsTagged('path-drag')`, which gathers a gesture family into one tool's variants, therefore lists two click-to-run commands among the anchor drags, and `actionsTagged('path-command')` leaves them out.
- evidence: read
- severity: low

## `constrainAnchors` stores any `length` param, including a negative, zero or NaN one, as a constraint that can never hold
- where: packages/path-tools/src/constraints/anchorConstraints.ts:94 (constraintsForAnchors)
- scenario: `trigger('constrainAnchors', { kind: 'length', length: -10 })` (or `NaN`, which `??` keeps). `length ?? measured` passes the value through unchecked. `setConstraints` stores the list even when the solve fails, so the path gains a conflict mark that no edit can clear (a length below zero cannot hold for any geometry), only deleting the constraint. Other numeric params in this area are validated (`isFiniteNumber(...) && > 0` in bridge, knead, anchorSelect, linkAnchor). A non-finite or negative length should fall back to the measured length, or the action should be disabled.
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
packages/path-tools/src/icons.gen.ts (generated; first 80 lines: the name union, `icon`, the start of ICON_GROUPS)
packages/path-tools/src/icons.table.ts
packages/path-tools/src/index.ts
packages/path-tools/src/kitSettings.ts
packages/path-tools/src/knead/knead.ts
packages/path-tools/src/knead/kneadTargets.ts
packages/path-tools/src/knead/useKneadTool.ts

<!-- done: 5 findings, files read: 37 -->
