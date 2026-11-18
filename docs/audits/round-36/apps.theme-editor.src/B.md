# Audit round 36 — apps.theme-editor.src

## The semantic drawer's literal field turns a number or array literal into a string
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:144 (RuleFields, literal branch)
- scenario: a semantic authored as `{ value: 0.5, type: 'number' }` or a cubicBezier `{ value: [0.32, 0, 0.67, 0], type: 'cubicBezier' }` (TokenValue admits numbers and arrays). The field shows `String(rule.value)` ("0.32,0,0.67,0"), and any edit writes the raw text back (`{ ...rule, value }`), so `0.5` edited to `0.6` becomes the string `'0.6'` and the bezier becomes the string `'0.32,0,0.67,0.1'`. The Pins/Components layer answers the same question with `parseTokenValue(type, text)` (TokenLayer.tsx:50) and seeds/PinRepair with `keepNumberness`; this path does neither, so the value's type changes under an ordinary edit.
- evidence: read
- severity: medium

## Toggling "Varies by" off and on for a rule split by a non-mode axis leaves the drawer editing a branch the new rule has no key for
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:152-166 (SemanticDrawer, branch state and setVaries)
- scenario: a semantic `{ by: 'density', comfortable: …, compact: … }` opens with `branch = 'comfortable'`. Uncheck "Varies by density" (rule collapses to the comfortable branch), then check it again: `setVaries(true)` rebuilds the rule as `{ by: 'mode', dark: …, light: … }`, but `branch` is still `'comfortable'` (state set once; the drawer is keyed by token name, so it is not remounted). `current` is now undefined, the fields show "This rule has no comfortable branch", and "Add a comfortable branch" writes a `comfortable` key into a by-mode rule. The branch should be re-picked from the new rule's values whenever it is not among them.
- evidence: read
- severity: low

## The swatch panel decides "pinned" by anchor name, which the three sources and the hex pin share
- where: apps/theme-editor/src/SwatchPanel.tsx:98-118,183-188 (SwatchPanel, pinnedNames / onSelect)
- scenario: the LEGO "Lavender" swatch is named `lavender` (line 80), the same as the crayon `lavender`; a color pinned from the hex box takes `anchorFromHex(hex)`'s default name, `hueName(H)`, which yields crayon names such as `rose`. Pin crayon `lavender`, open the LEGO tab: LEGO Lavender draws as pinned (glyph, pressed) though nothing from LEGO is, and clicking it runs `unpin('lavender')`, removing the crayon instead of pinning the LEGO color. Likewise pinning `#e8456e` from the hex box (named `rose`) marks the crayon `rose` pinned, and clicking that crayon unpins the hex color. `add` renames a clash to `name-2`, but the click never reaches `add` because the name test answers first. The pinned test needs the swatch's identity (its key or source), not the anchor's name.
- evidence: read
- severity: medium

## The categorical gates editor shows a gate that varies by axis or names a seed as a default number, and a slider move overwrites it
- where: apps/theme-editor/src/layers/RampsLayer.tsx:108-113,131 (GatesEditor)
- scenario: `CategoricalRampDef.gates` values are `Varying<number | string>` (definition.ts:47), so a gate may be `{ by: 'mode', dark: 3, light: 4.5 }` or `"{seeds.contrast}"`. `c` drops every by-axis gate (`filter(([, v]) => !isByAxis(v))`), so its slider shows `DEFAULT_CONSTRAINTS`' value, and keeps a seed reference as the raw string, so a `kind="number"` slider gets `"{seeds.contrast}"` and `generate(c)` (the unmet-gates explanation) computes with a string. Moving either slider runs `setGate`, which writes a plain number over the variation or the reference with no warning. The lightness editor in the same file answers this case the other way: a non-number param is drawn as a read-only note (lines 78-84). And with the gates it really used left out, the "No arrangement satisfies these gates" explanation (`unmetGates`) is measured against constraints the deriver never ran.
- evidence: read
- severity: medium

## A reload while the theme draft does not derive drops the whole undo history
- where: apps/theme-editor/src/ThemeWorkbench.tsx:152-159 with apps/theme-editor/src/useLabHistory.ts:54-60
- scenario: the draft is persisted only when it derives (`else if (error === null) persistDraft(...)`), but `useSavedLabHistory` saves the history beside `holder.current.value`, the non-deriving draft, on every change and on `pagehide`. Type half a reference (draft stops deriving), then reload: `start` is the last deriving draft (or the stored definition), `useLabHistory` finds `saved.state` differs from it and restores nothing, so every undo step, including the ones that would step back to a deriving draft, is gone. The two stores should agree on which state they keep (save the history only beside the state the draft store holds, or keep both).
- evidence: read
- severity: low

## The Scales layer derives the raw draft during render, so opening it while the draft does not derive crashes the app
- where: apps/theme-editor/src/layers/ScalesLayer.tsx:41 (ScaleSection, `useMemo(() => scaleTable(draft, …))`) via apps/theme-editor/src/theme/scales.ts:22-26
- scenario: the workbench deliberately keeps drawing when the draft stops deriving (ThemeWorkbench.tsx:135-143 falls back to the last good `derived` and shows "This draft does not derive"). Type a half-finished reference into a pin (Pins layer) or the semantic drawer's Reference field, e.g. `{gray-5`, so `derive` throws "Token … references …, which is not defined" (engine/references.ts:24); the editor stays up. Now click Scales in the rail: each `ScaleSection` calls `scaleTable(draft, …)`, which runs `axisDependencies(def)` and `derive(def, selection)` on the same broken draft, throws inside render, and with no error boundary anywhere above (labkit has none) React unmounts the whole app; the unsaved edit is only recoverable from storage. SemanticsLayer guards its one raw-draft call (`try { mergeChain(draft) } catch { derived.merged }`, SemanticsLayer.tsx:33-39); this one needs the same, or the table should come from `derived`.
- evidence: read
- severity: high

## "Compare in preview" derives the raw draft during render, so a non-deriving draft crashes the app while a ramp is focused
- where: apps/theme-editor/src/ThemeWorkbench.tsx:181-184 (`generatedTheme` useMemo)
- scenario: focus a ramp with "Compare in preview" (sets `focusRamp`). Then make the draft stop deriving, e.g. type `{nope` into a pin on the Pins layer. `deriveDraft` throws and is caught (lines 137-143), but `generatedTheme` then recomputes `runtimeTheme(adoptGenerated(draft, …))`, whose `bakeChain` calls `derive` (engine/bake.ts:47) on the same broken draft (only the ramp's own pins are removed), and throws uncaught during render. No error boundary sits above, so the whole app unmounts. It should catch like `deriveDraft`'s memo does, falling back to null (no generated variant).
- evidence: read
- severity: high

## The palette lab's saved history sits under its live state's key prefix, so every live save re-reads and parses up to a megabyte
- where: apps/theme-editor/src/presets.ts:61,122,126 (`LIVE_KEY`, `liveHistory`, `persistLive`)
- scenario: the history is kept at `weasel.theme-editor.live.history`, which starts with `LIVE_KEY` (`weasel.theme-editor.live`). `persistLive` and `loadLive` go through `writeSession`/`readStored`, which open a records cache with `prefix: key` (editor/sessionStore.ts:27), and `openRecordsSync` lists and `JSON.parse`s every localStorage key under that prefix (storage/webStorage.ts:21-28), so each call also parses the saved history, which `fitted` lets grow to 1,000,000 characters. `PaletteLab` calls `persistLive(state)` on every state change (PaletteLab.tsx:51-57), i.e. every slider tick during a drag, so a long session turns each tick into a megabyte parse. The draft store already learned this trap: draftStorage.ts:15 keeps draft histories off `DRAFT_PREFIX` on purpose. Moving the live history off the prefix (e.g. `weasel.theme-editor.live-history`) fixes it.
- evidence: read
- severity: medium

## Undo on the theme prefs page puts back every leaf, so it also reverts changes the step never made
- where: apps/theme-editor/src/usePrefsHistory.ts:24-37,54-62 (restoreHeld / write)
- scenario: each step snapshots what the store holds at every leaf (`heldOf(store, paths)`) before and after its write, and undo/redo run `restoreHeld`, which makes the store hold the snapshot "and nothing else": it resets, sets or un-autos every path that differs, not only the one the step wrote. A write that reaches the store any other way between the step and its undo (the same `theme-prefs.` records changed in a second tab, which the localStorage-backed store hears, or any caller writing the store directly) is undone with it. Tab A sets `surface`; tab B sets `radius-md`, which tab A's store picks up; Undo in tab A resets `radius-md` as well. The swap should carry, and restore, only the paths whose held value changed between `prev` and `next`.
- evidence: read
- severity: low

## Saving a preset under a built-in's name does nothing and says nothing
- where: apps/theme-editor/src/PresetBar.tsx:32-40,96 (PresetBar, save)
- scenario: type `Default` (or any built-in name) and press Save or Enter: the button is enabled (`disabled={!name.trim()}`), `save` returns early at line 35, the name stays in the field, and no message appears, so the user's state looks saved and is not. The button should disable, or the bar should say the name is taken, as the theme editor's New theme dialog does with `themeNameProblem`.
- evidence: read
- severity: low

## Files read
apps/theme-editor/src/AnchorList.tsx
apps/theme-editor/src/App.tsx
apps/theme-editor/src/HistorySlot.tsx
apps/theme-editor/src/LayerRail.tsx
apps/theme-editor/src/PaletteLab.module.css
apps/theme-editor/src/PaletteLab.tsx
apps/theme-editor/src/PalettePreview.tsx
apps/theme-editor/src/PinIcon.tsx
apps/theme-editor/src/PinRepair.tsx
apps/theme-editor/src/PresetBar.tsx
apps/theme-editor/src/SwatchPanel.tsx
apps/theme-editor/src/ThemeEditor.module.css
apps/theme-editor/src/ThemeEditor.tsx
apps/theme-editor/src/ThemePrefs.module.css
apps/theme-editor/src/ThemePrefs.tsx
apps/theme-editor/src/ThemePreview.tsx
apps/theme-editor/src/ThemeWorkbench.tsx
apps/theme-editor/src/TokenLayer.tsx
apps/theme-editor/src/TokenReference.tsx
apps/theme-editor/src/app.css
apps/theme-editor/src/historyStorage.ts
apps/theme-editor/src/icons.gen.ts
apps/theme-editor/src/labTestSetup.ts
apps/theme-editor/src/layers/RampsLayer.tsx
apps/theme-editor/src/layers/ScalesLayer.tsx
apps/theme-editor/src/layers/SemanticDrawer.tsx
apps/theme-editor/src/layers/SemanticsLayer.tsx
apps/theme-editor/src/main.tsx
apps/theme-editor/src/palette/ConstraintsPanel.tsx
apps/theme-editor/src/palette/copicColors.ts (header read; the data rows checked by search for duplicate codes, not read line by line)
apps/theme-editor/src/palette/crayons.ts
apps/theme-editor/src/palette/legoColors.ts
apps/theme-editor/src/palette/unmetGates.ts
apps/theme-editor/src/presets.ts
apps/theme-editor/src/theme/api.ts
apps/theme-editor/src/theme/draft.ts
apps/theme-editor/src/theme/draftStorage.ts
apps/theme-editor/src/theme/entries.ts
apps/theme-editor/src/theme/exportFiles.ts
apps/theme-editor/src/theme/fixtures.ts
apps/theme-editor/src/theme/inspect.ts
apps/theme-editor/src/theme/issues.ts
apps/theme-editor/src/theme/model.ts
apps/theme-editor/src/theme/ramps.ts
apps/theme-editor/src/theme/scales.ts
apps/theme-editor/src/theme/semantics.ts
apps/theme-editor/src/theme/starter.ts
apps/theme-editor/src/useFlash.ts
apps/theme-editor/src/useLabHistory.ts
apps/theme-editor/src/usePrefsHistory.ts

<!-- done: 10 findings, files read: 50 -->
