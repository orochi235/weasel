# Audit 79 — labkit.controls findings

## A canceled drafted edit never puts the drafts back: labField passes no `cancel` to `withDrafts`
- where: packages/labkit/src/controls/fields.tsx:88 (labField); also labSource.ts:170 (labRowContext `drafts` has no `cancel`)
- scenario: ControlPanel given `draftConfig` (e.g. the `Stops` story, whose draft writes config). Type `0.1` into a number field (each keystroke goes to `draftConfig`), then press Escape. `setConfig` is correctly never called, but nothing tells the owner the edit was canceled, so the instrument keeps the last drafted value as if it were live. ui's own path (`leafField.ts:37`) passes `ctx.drafts.cancel` to `withDrafts` for exactly this, and its test "puts the drafts back when the edit is canceled" covers it; labkit's call drops the argument, and `draftConfig` has no cancel counterpart at all.
- evidence: read
- severity: medium

## An uncontrolled panel pins an auto row on its first draft, so Escape leaves it pinned
- where: packages/labkit/src/controls/ControlPanel.tsx:197 (usePanelAuto, `draftConfig: writes.draftConfig && pinning(writes.draftConfig)`)
- scenario: ControlPanel with no `auto` prop (keeps its own set) and a `draftConfig`; a leaf starting `.initial(AUTO)`. Type one digit in its field: the draft goes through `pinning`, which removes the path from the own auto set. Press Escape: no `setConfig` happens, but the row is now pinned at the stale stored value underneath. With a controlled `auto` set the same draft does not pin (the owner's `draftConfig` is passed through untouched), so the two modes disagree about whether a draft pins.
- evidence: read
- severity: medium

## Rows decode an encoded leaf without its siblings, while the panel's source decodes with them
- where: packages/labkit/src/controls/fields.tsx:79 (labField state has no `siblings`/`update`); callers ControlRow.tsx LeafRow via rowAuto.ts:72 `leafValueAt`, ControlBar.tsx, rows.tsx PairedRow, panelHeadings.tsx liftedControl
- scenario: a leaf with an `encoding` whose `read`/`write` use the sibling object (prefField.tsx `throughEncoding` reads `encoding.read(state.value, state.siblings)` and writes `encoding.write(option, state.siblings)`). labField hands `prefFieldProps` only `{ value, setValue, fields, disabled }`, so the encoding reads and writes against `undefined` siblings: the control shows the wrong option, and a write computes the stored form without the object it belongs to. `labSource.shownAt` decodes the same leaf with its siblings (`prefDecodedValue(leaf, stored, within)`), so the source's `valueAt` (and resets/`sourceIsAtReset` built on it) and the drawn row answer differently. Also `leafValueAt` substitutes `leaf.default` (the option, per `storedDefault`) for an absent stored value, and that option is then decoded as if it were the stored form.
- evidence: read
- severity: medium

## A pair's "needs the whole row" check misses segmented toggles and any enum whose control is not declared
- where: packages/labkit/src/controls/panelNode.tsx:186 (pairedRow `span`)
- scenario: the pair spans only when a cell's raw extra `control === 'radio'`. `spansGrid` (controlPack.ts:32) gives the same answer for a row as `field.control === 'toggle' || field.control === 'radio'`, read off the resolved field. A pair holding an enum drawn as a segmented `toggle`, or one whose control `prefFieldProps` picks rather than the leaf declaring, sits in half a grid line with every choice squeezed in, while the same leaf on its own row spans. One decision, answered two ways.
- evidence: read
- severity: low

## The matrix popover keeps its captured cell after the cell's row or target changes
- where: packages/labkit/src/controls/ControlMatrix.tsx:113 (`onOpen` stores the `OpenCell`, including the `MatrixTarget`), MatrixEditor.tsx:55
- scenario: open a cell's popover, then make an edit in it (or elsewhere) that flips a `showIf` hiding that row, or that changes which leaf an alias resolves to. `open` still holds the old `cell` (`leaf`, `at`), so the popover stays up editing a setting no longer drawn, or writes to the alias's old target path (`setConfig(at, …)` in MatrixEditor and the Clear button). Nothing re-derives `open.cell` from `cellAt(open.path)` or closes the popover when the row disappears.
- evidence: read
- severity: low

## inDialog's `update` reads the render's draft, so two updates in one event lose the first
- where: packages/labkit/src/controls/inDialog.tsx:155 (`update = (fn) => setDraft(fn(draft))`), DraftDialogRow.tsx:33 (`setDraft({ value: next })`, not functional)
- scenario: a dialog body updates two fields from one handler: `update(v => ({...v, a: 1})); update(v => ({...v, b: 2}))`. Both apply to the same render's `draft`, so the second write replaces the first and Done commits only `b`. `update` exists for derive-from-current writes; it should fold into the latest draft.
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

<!-- done: 6 findings, files read: 36 -->
