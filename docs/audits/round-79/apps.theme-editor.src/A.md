# Audit round 79 — apps.theme-editor.src

## Editing a token whose own pin varies by an axis the theme does not declare throws out of the change handler
- where: apps/theme-editor/src/TokenLayer.tsx:54 (write) via apps/theme-editor/src/theme/model.ts:126 (branchOf, from writeAt/clearAt)
- scenario: a draft pins `button-radius: { by: 'density', compact: …, comfortable: … }` but neither it nor its parent declares a `density` axis. The pin does not apply (`pinApplies` is false), so the token shows on its own layer page (Components) with the rule's value. When someone types a new value, `write` calls `writeAt(own, selection, pin)`. `selection` is `fullAxisChoice` over the declared axes, so it has no `density`, and `branchOf` throws "no density value is chosen…" inside the React onChange handler. The edit is lost and the error goes uncaught. Reset (`clearAt`) throws the same way. What should happen instead: the editor either replaces the pin that does not apply or refuses the edit with a message. It should not throw.
- evidence: read (reasoned from the code; not run)
- severity: low

## "Copy as tokens" copies a JSON fragment, not a token document
- where: apps/theme-editor/src/PalettePreview.tsx:92 (PalettePreview, tokenJson)
- scenario: the copied text is a series of lines like `    "swatch-red":  { "$value": "#…" },` with no enclosing `{ … }`, so pasting it as a `.tokens.json` file, or parsing it, fails with a JSON syntax error. The button is labeled "Copy as tokens", and what it copies only works when pasted inside an existing group.
- evidence: read
- severity: low

## A stored palette state's `count` is accepted at any finite value
- where: apps/theme-editor/src/presets.ts:73 (constraintsOf)
- scenario: `constraintsOf` keeps any finite number for every numeric constraint. So a saved live state or preset holding `count: 0`, a negative count, `7.5` or `1e6` is restored as is, even though the control only offers integers from 5 to 32. With `count: 0`, `Marks` computes `slot = (W - 20) / 0`, and the generator is handed an impossible set. With a huge count, `generate` runs on the main thread at mount. What should happen: the docstring says it keeps a value "the generator reads", so the count should be clamped to an integer in the slider's range, or dropped to the default (anchor lightness is range-checked the same way).
- evidence: read
- severity: low

## When storage refuses a draft history, the theme is still recorded as holding one, and it takes another theme's slot
- where: apps/theme-editor/src/theme/draftStorage.ts:47 (draftHistory.save)
- scenario: `save` writes the history order with `name` first before the write is tried. When both `writeLocal` calls fail (quota still full after clearing the others), the order still lists `name` with nothing stored under it. The next save for another theme counts it against `KEPT_HISTORIES` (2), which evicts a history that really is stored. What should happen: `name` goes into the order only once its write succeeds.
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
apps/theme-editor/src/palette/copicColors.ts
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

<!-- done: 4 findings, files read: 50 -->
