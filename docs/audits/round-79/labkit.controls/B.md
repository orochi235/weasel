# Audit round 79 — labkit.controls findings

## An encoded leaf holding nothing is handed its decoded default as though it were the stored value
- where: packages/labkit/src/controls/fields.tsx:53 (leafValueAt), used by packages/labkit/src/controls/rowAuto.ts:71 (useRowAuto `pinned`), packages/labkit/src/controls/rows.tsx:97 (PairedRow), packages/labkit/src/controls/panelHeadings.tsx:34 (liftedControl), packages/labkit/src/controls/panelNode.tsx:80 (barRow `value`); same shape in packages/labkit/src/controls/MatrixCell.tsx:62 and packages/labkit/src/controls/MatrixEditor.tsx:59
- scenario: an encoded boolean or enum leaf (from `fromPrefs`, e.g. an Italic toggle storing `fontStyle: 'italic'`) whose config holds nothing. `leafValueAt` is `prefValueOrDefault(leaf, undefined)`, i.e. `leaf.default` — and an encoded leaf's default is the *decoded* option (`storedDefault.ts`: "An encoded leaf's default is the option it reads as, not what it stores"). That decoded value is passed as `state.value` to `prefFieldProps`, which runs it through `encoding.read` a second time (`prefField.tsx` `throughEncoding`), so the control shows `read(true)` instead of `read(undefined)` — typically the wrong option. `labSource.shownAt` exists precisely to avoid this (it reads the stored value raw and decodes it) and the source, reset and conditions agree with it, so the built-in row and the source disagree about what the leaf shows.
- evidence: read (fields.tsx, labSource.ts shownAt, storedDefault.ts, prefs-schema/src/shown.ts, ui Prefs/prefField.tsx throughEncoding)
- severity: medium

## labkit's fields never pass `siblings`, so an encoding that reads or writes against its object gets `undefined`
- where: packages/labkit/src/controls/fields.tsx:79 (labField, `state = { value, setValue: write, fields, disabled }`)
- scenario: an enum leaf with an `encoding` whose `read(stored, siblings)` / `write(option, siblings)` consult the object it is a field of (what `PrefFieldState.siblings` is documented for). `labField` builds the state with no `siblings`, so `throughEncoding` reads `encoding.read(value, undefined)` and writes `encoding.write(option, undefined)`: the control can show the wrong option and a write can drop the sibling-derived part of the stored value. `labSource.shownAt` reads the same leaf with `siblings = configValueAt(config, parent)`, so the row and the panel's source (conditions, reset, custom renderers) answer differently for the same leaf.
- evidence: read (fields.tsx labField; labSource.ts shownAt; ui Prefs/prefField.tsx PrefFieldState and throughEncoding)
- severity: medium

## Escape on a drafted number/slider/text edit never puts the drafts back
- where: packages/labkit/src/controls/fields.tsx:87 (labField's `withDrafts(...)` call)
- scenario: a panel given `draftConfig` (as `ControlPanel.stories` Stops/Drafts do, where the draft is written into the instrument's config). Type `12` into a number field, then press Escape. Each keystroke reached `draftConfig`; Escape writes nothing to `setConfig`, but nothing tells the owner the draft was abandoned either, so the instrument keeps drawing the drafted `12` while the committed value is the old one. `withDrafts` takes a fifth `cancel` argument for exactly this ("puts the drafts back when the edit is canceled", commitPolicy.test.ts) and ui's `leafField.ts` passes `ctx.drafts.cancel`; labkit's `labField` omits it, and `labRowContext`'s `drafts` has no `cancel` either. ControlPanel's doc ("Escape writes nothing") holds for `setConfig` only.
- evidence: read (fields.tsx; ui Prefs/commitPolicy.ts withDrafts; ui Prefs/leafField.ts:37)
- severity: medium

## With the panel keeping its own auto set, a draft pins the row, and Escape leaves it pinned at the stale value
- where: packages/labkit/src/controls/ControlPanel.tsx:203 (usePanelAuto, `draftConfig: writes.draftConfig && pinning(writes.draftConfig)`)
- scenario: no `auto` prop; a leaf starts `.initial(AUTO)`, so its row is auto and shows the resolver's value. Type one digit into its field (or start a slider drag) and press Escape. The draft went through `pinning`, which removed the path from the panel's own set; the cancel writes no `setConfig`. The row is now pinned and draws `config`'s stale pinned value underneath (not the auto value it showed, nor the draft), though the user canceled the edit. Pinning should happen on the settled write only.
- evidence: read
- severity: medium

## One section declaring `collapsed` makes every section and group in the panel foldable
- where: packages/labkit/src/controls/ControlPanel.tsx:246 (sectionFold, `folds = … || resolved.sections.some((s) => s.collapsed !== undefined)`)
- scenario: a schema with two sections, one declared `{ collapsed: false }`, no `collapse`/`collapsed`/`onCollapse` on the panel. The prop doc says the declaration "makes that section foldable on its own and outranks this for that one section". The code turns `folds` on panel-wide, and the returned function hands `collapsible: folds` to every key — so the undeclared section, and every framed group (`groupRow` calls `s.fold(path, …)`), also get a twisty.
- evidence: read
- severity: low

## A paired row holding a segmented `.toggle()` enum does not take the whole row
- where: packages/labkit/src/controls/panelNode.tsx:186 (pairedRow `span`)
- scenario: `f.enum(...).toggle().pair({ with: … })`. `pairedRow` spans only when a cell's `control` extra is `'radio'`, while `spansGrid` (controlPack.ts) and `ControlPack`'s doc treat both `'toggle'` and `'radio'` enums as needing the whole width. The same question is answered two ways, and the segmented toggle in a pair is squeezed into half a grid track.
- evidence: read (panelNode.tsx, controlPack.ts spansGrid, config/builder.ts `toggle()` sets `control: 'toggle'`)
- severity: low

## inDialog's `update` reads the render's draft, so two updates in one event lose the first
- where: packages/labkit/src/controls/inDialog.tsx:157 (`update = (fn) => setDraft(fn(draft))`)
- scenario: a dialog body that calls `ctx.update(f1)` then `ctx.update(f2)` in one handler (e.g. a reset that adjusts two fields of an object value). Both read the same closed-over `draft`; `DraftDialogRow`'s writer is a plain `setDraft({ value })`, so the second write replaces the first and `f1`'s change is lost. `update` promises a functional update, which this is not.
- evidence: read (inDialog.tsx, DraftDialogRow.tsx)
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
