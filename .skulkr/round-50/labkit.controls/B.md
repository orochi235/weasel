# labkit.controls findings

## An uncontrolled panel's auto set is rebuilt from a stale closure, so several writes in one event lose all but the last one's (un)pinning
- where: packages/labkit/src/controls/ControlPanel.tsx:159 (usePanelAuto, `pinning`)
- scenario: a `ControlPanel` with no `auto` prop (it keeps its own set) and two auto-capable leaves `a`, `b`, both pinned. A reset of the whole panel (`source.reset([''])`, labSource.ts:100) writes its plan one leaf at a time in the same event: `setConfig('a', AUTO)`, then `setConfig('b', 5)`. Each call computes `applyConfigWrite(config, [...ownAuto], …)` from the render's `ownAuto` and calls `setOwnAuto(new Set(...))` with a value, not an updater: the first sets `{a}`, the second, still seeing `{}`, sets `{}`. `a` ends pinned, so the reset did not unpin it. Same for `source.reset([p1, p2])` with two separate paths, or a custom renderer that writes two paths in one handler (the second write re-adds the first path to the set as auto, discarding its pin). Should fold each write into the latest set (functional `setOwnAuto(prev => …)`), as `mark` beside it already does.
- evidence: read (ControlPanel.tsx:159-170, labSource.ts:96-117, config/autoConfig.ts:152-168; prefs' reset plan emits `AUTO` for auto leaves, resetPlan.test.ts:48)
- severity: medium

## `inDialog` drops the row's `disabled`, so a dialog row under a failing `enableIf` still opens and writes
- where: packages/labkit/src/controls/inDialog.tsx:122 (inDialog's renderer)
- scenario: a leaf registered with `.dialog(body)` (or a lab renderer built with `inDialog`) whose `enableIf` (its own or a group's above it) is false. `ControlRow` hands the renderer `ctx.disabled === true` (labSource.ts:172), but `inDialog` passes `DraftDialogRow` no `disabled`, so the row's button stays live: the dialog opens, Done writes the draft to a setting the schema says takes no input. The built-in compound row on the same path passes `disabled` (ControlRow.tsx:352) and is inert. Should pass `disabled={ctx.disabled}` (DialogRow takes it, Properties/DialogRow.tsx:58).
- evidence: read
- severity: medium

## A `resettable` group drawn `as: 'section'` loses its reset button in `ControlPanel`
- where: packages/labkit/src/controls/panelNode.tsx:104-120 (groupRow)
- scenario: `f.group('View', {...}, { as: 'section' }).resettable()`. `groupRow` builds `reset` (a `ResetGroup`) and the lifted heading control, then for `as === 'section'` returns a `Subpanel` with neither — no `actions` — though `Subpanel` takes `actions` for exactly "a reset button" (ui Properties/Subpanel.tsx:16-17). The group cannot be reset from the panel; the framed branch below and ui's `PrefsForm` (Prefs/groupHeading.tsx:44-61, which places `groupReset` whatever the group's `as`) both draw it. Should pass `actions={headingActions(lifted.control, reset)}` and `lifted.path` to the body as the framed branch does.
- evidence: read
- severity: medium

## A matrix cell that is an alias of an enum opens a dropdown inside the popover, which stays open after a choice
- where: packages/labkit/src/controls/MatrixEditor.tsx:50-77 (MatrixEditor)
- scenario: a `ControlMatrix` row whose cells are `f.alias(...)` of enum leaves (the "matrix drawn from a layout over a dialog's settings" case `over` exists for). The cell itself draws as the target enum (MatrixSlot hands MatrixCell `cell.leaf`), but the editor builds its field from `open.leaf`, the alias node (`leaf: cell.node`, MatrixRow.tsx:89), and `prefFieldProps` returns `null` for `kind: 'alias'` (ui Prefs/prefField.tsx:271). So the enum branch — `enumControlAt(…, 'popover')`, which turns a popup control into radios, and `close()` on choosing — never runs; it falls to `ControlRow`, which draws the lab's select (a popup inside the popover) and leaves the popover open after the pick. A direct enum cell in the same matrix gets radios and closes. Should build the field from `open.cell.leaf` read at `open.cell.at`.
- evidence: read
- severity: low

## An alias row into another schema (`over`) shows a reset button that writes nothing
- where: packages/labkit/src/controls/rowAuto.ts:107-119 (rowReset), with labSource.ts:96-117 (createLabConfigSource.reset)
- scenario: `ControlPanel` drawn from a schema of aliases with `over` = the schema they point into; an alias row whose target `view.gap` (default 8) holds 12. `ControlRow` draws it as `LeafRow` at the target's path with the target's leaf (ControlRow.tsx:123). `rowReset` builds its source over `resolved` (the alias schema) with no `over`; `sourceLeafIsAtReset` compares the target leaf's default with `configValueAt(config, 'view.gap')`, finds 12 ≠ 8, and offers `onReset`. Clicking it runs `source.reset(['view.gap'])` → `sourceResetPlan` → `resetPlans(resolved.group, …)`, where `prefNodeAt` finds no node at `view.gap` in the alias schema and returns `[]` (prefs/autoReset.ts:163-164), so `under` is empty and nothing is written. The row keeps a live reset control that does nothing. Either the reset should plan over the schema the leaf lives in (`over`), or no reset should be offered.
- evidence: read
- severity: medium

## An uncontrolled panel's auto set is seeded once and never follows a new `schema`
- where: packages/labkit/src/controls/ControlPanel.tsx:146-148 (usePanelAuto)
- scenario: a lab renders one `<ControlPanel schema={trial.configSchema} …>` without `auto` and switches trials, so `schema` changes while the component stays mounted. `useState(() => new Set(startAutoPathsOf(resolved)))` ran only for the first schema: the new trial's `.initial(AUTO)` leaves are not in the set, so they draw pinned (their stored/default value, no `auto` readout, the instrument's resolver not applied in `shown`), and the old trial's paths stay in the set, feeding `resolveAutoConfig` and `applyConfigWrite` paths the schema no longer has. A trial opened fresh in the same panel should start with its own start-auto set; the set needs re-seeding when `resolved` changes (or keying on it).
- evidence: read
- severity: low

## The AutoControls story tells the reviewer an auto row draws no control, which the panel no longer does
- where: packages/labkit/src/controls/AutoControls.stories.tsx:78-83 (BothStates blurb)
- scenario: the story exists to be checked by eye ("the only place they can be checked"), and says "an auto row shows no control at all — only its label and the word `auto`". The panel keeps an auto row's control live and ghosted, drawing the value in effect (rowAuto.ts:80-83; ControlPanel.tsx:100-101, "reads out `auto` beside its live, ghosted control"). A reviewer following the blurb reads correct output as a regression, or a regression that hid the control as correct.
- evidence: read
- severity: low

## Files read
packages/labkit/src/controls/AutoControls.stories.tsx
packages/labkit/src/controls/ControlBar.tsx
packages/labkit/src/controls/ControlMatrix.less
packages/labkit/src/controls/ControlMatrix.stories.less
packages/labkit/src/controls/ControlMatrix.stories.tsx
packages/labkit/src/controls/ControlMatrix.tsx
packages/labkit/src/controls/ControlPanel.less
packages/labkit/src/controls/ControlPanel.stories.tsx
packages/labkit/src/controls/ControlPanel.tsx
packages/labkit/src/controls/ControlPanelHeading.stories.tsx
packages/labkit/src/controls/ControlPanelMotif.stories.tsx
packages/labkit/src/controls/ControlRow.tsx
packages/labkit/src/controls/CurveRow.tsx
packages/labkit/src/controls/DraftDialogRow.tsx
packages/labkit/src/controls/MatrixCell.tsx
packages/labkit/src/controls/MatrixEditor.tsx
packages/labkit/src/controls/MatrixHeads.tsx
packages/labkit/src/controls/MatrixPopover.tsx
packages/labkit/src/controls/MatrixRow.tsx
packages/labkit/src/controls/MatrixSlot.tsx
packages/labkit/src/controls/PanelEditing.stories.tsx
packages/labkit/src/controls/ResetGroup.tsx
packages/labkit/src/controls/boundAction.ts
packages/labkit/src/controls/controlPack.ts
packages/labkit/src/controls/fieldChoices.ts
packages/labkit/src/controls/fields.tsx
packages/labkit/src/controls/inDialog.tsx
packages/labkit/src/controls/index.ts
packages/labkit/src/controls/labSource.ts
packages/labkit/src/controls/matrixTarget.ts
packages/labkit/src/controls/panelHeadings.tsx
packages/labkit/src/controls/panelNode.tsx
packages/labkit/src/controls/panelPaths.ts
packages/labkit/src/controls/panelRows.tsx
packages/labkit/src/controls/rowAuto.ts
packages/labkit/src/controls/rows.tsx

<!-- done: 7 findings, files read: 36 -->
