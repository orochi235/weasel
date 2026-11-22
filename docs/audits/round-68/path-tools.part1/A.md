# Findings: path-tools.part1

## linkAnchor's reach accepts an infinite `reachPx`, so a drop ties to whatever node is first in the scan
- where: packages/path-tools/src/constraints/linkAnchor.ts:52 (reachOf)
- scenario: `tune={{ linkAnchor: { reachPx: Infinity } }}` (or a replay with it) → `typeof === 'number' && > 0` passes, `reach` is Infinity, every anchor of every node is "within reach" and the drop links to the nearest anchor anywhere on the canvas, however far. Every sibling param reader here (`bridgeTensionOf`, `stepOf`, `shareOf`) guards with `isFiniteNumber`; this one should fall back to the default (or clamp to the form's max of 30) for a non-finite value.
- evidence: read
- severity: low

## linkTargetAt's segment tolerance grows past `reachPx` under a non-uniform view scale
- where: packages/path-tools/src/constraints/linkAnchor.ts:101,79 (linkTargetAt / landingOn)
- scenario: view scale `{x: 4, y: 1}`, reachPx 6 → `reach = 6 / min(4,1) = 6` world units, then `segmentAt` gets `tolerancePx: reach * max(scale) = 24` screen px: a segment 20 px away on screen is taken as a landing, four times the reach the param names. The anchor test (world distance ≤ reachPx/minScale) and the segment test disagree on what "within reachPx screen px" means. The tolerance should be `reachPx` itself, since `segmentAt` already gets `scale`.
- evidence: read
- severity: low

## handleSnapSource throws on every handle move when `angleStep` is NaN or ±Infinity
- where: packages/path-tools/src/handleSnap/handleSnap.ts:57-59 (handleSnapSource, angles)
- scenario: `createHandleSnapPreset(() => ({ angleStep: settings.step * DEG_TO_RAD }))` where a cleared form field gives `NaN` (or a caller passes `Infinity` meaning "no steps") → `step <= 0` is false, so `stepAngles(q.theta, NaN)` runs and throws `RangeError: stepAngles: step must be finite and nonzero` from inside the snap session on every pointer move of a control-handle drag. The guard should be `!isFiniteNumber(step) || step <= 0` and skip the steps, as `0` does.
- evidence: read (`packages/core/src/domains/snap/stepAngles.ts:5` throws on non-finite)
- severity: medium

## `@weasel-js/path-tools/groups` omits the `constraints` group its own actions use
- where: packages/path-tools/src/groups.ts:14-16; packages/path-tools/src/constraints/anchorConstraints.ts:141,172
- scenario: the module's doc says it names "the `group` each of path-tools' own actions sits in" and that the rest sit in core's `anchors`/`path` groups. `constrainAnchors`, `unconstrainAnchors` and `deleteConstraint` sit in a literal `'constraints'` group that is in neither: `<ActionBar group={pathToolsGroups.constraints} />` is undefined, and a consumer has to hard-code the string. Add `export const constraints` (from a constant the actions also use) or move the actions into a listed group.
- evidence: read (grep finds `'constraints'` as a group only in anchorConstraints.ts)
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

<!-- done: 4 findings, files read: 37 -->
