I read all 36 files in the area, but couldn't create `.skulk/out/findings.md`: the Write tool was denied and the shell rejected the heredoc. As the brief allows, the whole document is below. Nothing in the tree was changed.

# Findings: labkit.controls (round 50)

## A panel keeping its own auto set loses all but the last unpin when one reset writes several leaves
- where: packages/labkit/src/controls/ControlPanel.tsx:162 (usePanelAuto, `pinning`); the writes come from packages/labkit/src/controls/labSource.ts:100 (createLabConfigSource `reset`, path `''`)
- scenario: An uncontrolled panel (no `auto` prop) draws a schema where leaves `a` and `b` are both `.initial(AUTO)`. The user pins both, then resets the whole panel (a reset of `''`). `reset` calls `setConfig(w.path, AUTO)` once per leaf in the plan. Each call runs `applyConfigWrite(config, [...ownAuto], …)` against the same render's `ownAuto` closure. It then calls `setOwnAuto(new Set(next.autoPaths))` with a plain value, not an updater. So the second call's set (`ownAuto ∪ {b}`) replaces the first call's (`ownAuto ∪ {a}`). Afterwards only `b` reads auto. The `isAuto(value)` guard also writes nothing through for `a`, so the reset does nothing to `a` at all. Expected: both rows unpinned, which is what a controlled owner gets when it applies each write in turn.
- evidence: read
- severity: medium

## An alias row's reset does nothing when the panel's aliases point into another schema (`over`)
- where: packages/labkit/src/controls/rowAuto.ts:117 (rowReset); packages/labkit/src/controls/labSource.ts:57, 96-117 (createLabConfigSource)
- scenario: Take the story `AliasesIntoAnotherSchema`: schema `{ spacing: f.alias('view.spacing') }`, `over={dialogSchema}`. ControlRow draws the alias as the target leaf at the target path `view.spacing`. That path exists only in `over`. `rowReset` builds a source over `resolved.group` and doesn't pass `over`, so `leafOf('view.spacing')` is undefined. Then `valueAt` returns the raw config value. Edit Spacing to 12 and the reset glyph appears, because `sourceLeafIsAtReset` compares against the target leaf's default. Clicking it calls `source.reset(['view.spacing'])`, which calls `resetPlans(resolved.group, …)`. `prefNodeAt` finds no node, the plan is empty, and nothing is written. The panel-level `prefs` source has the same problem: its `schema`, `leafOf` and `autoAt` all read `resolved.group`. Expected: the reset writes `8` back to `view.spacing`.
- evidence: read
- severity: medium

## An `inDialog` body's `ctx.update` and `ctx.drafts` write straight to the config, past the dialog's draft
- where: packages/labkit/src/controls/inDialog.tsx:132 (inDialog); the context comes from packages/labkit/src/controls/labSource.ts:167-168 (labRowContext)
- scenario: The body is handed `{ ...ctx, value: draft, setValue: setDraft }`. Only `value` and `setValue` are redirected. `ctx.update(fn)` is still labRowContext's `write(fn(value))`, which calls `input.setConfig(path, …)` immediately and works from the stored value, not the draft. `ctx.drafts.setValue` still goes to `draftConfig`. A body written with `update` (e.g. `ctx.update(v => ({ ...v, x: 1 }))`) commits on every edit, ignores the draft's earlier edits, and Cancel can't undo it. That breaks inDialog's contract that "Done writes, Cancel or Escape drops". `each` is also left at the stored value. Expected: `update` applies `fn` to the draft and calls `setDraft`, and `drafts` is dropped or routed to the draft.
- evidence: read
- severity: medium

## A group drawn `as: 'section'` drops its `resettable` reset and doesn't lift its `.heading()` control
- where: packages/labkit/src/controls/panelNode.tsx:103-120 (groupRow)
- scenario: Take `f.group({ on: f.boolean(true).heading(), blur: … }).as('section').resettable()`. `groupRow` computes `lifted` and `reset`, but the `as === 'section'` branch renders a `<Subpanel>` with no `actions` (Subpanel accepts `actions`). The group gets no reset control at all. The `.heading()` leaf isn't drawn in the heading either: `draw.body` is called without `lifted`, so it falls back to an ordinary row. Expected: the same heading actions as the framed branch (`headingActions(lifted.control, reset)`, with `lifted.path` passed to `body`). ui's PrefsForm draws the reset on every resettable heading (`groupHeading.tsx`), so the two surfaces disagree on the same schema.
- evidence: read
- severity: low

## A `.dialog` leaf's auto readout never quotes its value, though a compound row's does
- where: packages/labkit/src/controls/inDialog.tsx:127 (inDialog)
- scenario: An auto leaf drawn through `inDialog` (a node `.dialog`, or `resolved.dialogs`) shows the plain word `'auto'`. The same leaf drawn as a built-in compound row gets `useRowAuto`'s `readout`. That is a `PropertyAutoReadout` quoting the resolved value wherever `autoQuotes(leaf)` holds. So one auto leaf reads differently depending on whether its dialog is custom.
- evidence: read
- severity: low

## The AutoControls story describes the old auto row: "shows no control at all"
- where: packages/labkit/src/controls/AutoControls.stories.tsx:79-83 (BothStates doc)
- scenario: The blurb says an auto row "shows no control at all — only its label and the word `auto`". The code (`ControlPanelProps.auto` docs, `useRowAuto`) draws an auto row's control live and ghosted, with the readout beside it, and an edit pins the row. A reviewer checking the story against its blurb will read correct behavior as a bug.
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