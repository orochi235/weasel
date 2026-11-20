I couldn't finish writing the findings file. The first three findings reached `.skulk/out/findings.md`, but writing the rest to it was refused (the permission prompt went unanswered). The full document is below, as the brief allows.

# Audit round 40: apps.theme-editor.src

## Editing a pin that varies by axis in the Pins layer replaces it with one value for every mode
- where: apps/theme-editor/src/TokenLayer.tsx:47 (TokenLayer write); its entries come from apps/theme-editor/src/theme/entries.ts:30
- scenario: the fixtures' `child` theme pins `surface` as `{ by: 'mode', dark: {value:'#0a0a14'}, light: {value:'#fafaf7'} }`. In the Pins layer the row shows the value for the default mode only. The Components layer does the same for a pinned component token. Editing that value calls `setPin(draft, 'surface', { value, type })`, which writes a plain pin over the whole `by` object. The dark branch's color is silently thrown away, and dark mode now takes the light value. It should write only the branch it shows, or refuse the way PinRepair does with "varies by axis".
- evidence: read
- severity: medium

## Editing a seed that varies by axis stores its JSON text as a string seed
- where: apps/theme-editor/src/TokenLayer.tsx:37 (TokenLayer write, seeds branch); apps/theme-editor/src/theme/entries.ts:9 (seedText)
- scenario: seeds are `Varying<number | string>` (packages/theme/src/definition.ts:111), so a seed can be `{ "by": "mode", "light": 0.01, "dark": 0.02 }`. The Seeds layer lists it as its `JSON.stringify` text. Editing it (say 0.02 to 0.03) calls `keepNumberness(text, previousObject)`. Because the previous value is not a number, that returns the raw text, so the seed becomes the string `'{"by":"mode",...}'` instead of the varying object. Every `{seeds.x}` reference then reads a string. It should parse the JSON back, or not offer a by-axis seed as editable text.
- evidence: read
- severity: medium

## Changing the ramp of a step rule whose step varies by axis drops the variation
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:129 (RuleFields, step branch)
- scenario: take a semantic `{ ramp: 'gray', step: { by: 'density', comfortable: '200', compact: '300' } }`. The drawer says "The step varies by density; edit it in the definition file", but it still offers the Ramp select. Picking another ramp writes `{ ...rule, ramp, step: firstStep }`, which replaces the by-axis step with one plain step without warning. It should keep a by-axis step, or disable the Ramp select next to it.
- evidence: read
- severity: low

## The palette lab's stat verdicts judge fixed thresholds, not the gates the generator was given
- where: apps/theme-editor/src/PalettePreview.tsx:109 (PalettePreview, the min contrast, min distance and from-surface Stats)
- scenario: set "Between colors" to 0.30 and get a palette that reaches 0.25. PaletteLab's infeasible line says "distance between colors reaches 0.250 of 0.30". The "min distance" stat is still drawn green ("ok"), because it compares against a hard-coded 0.22. The same happens elsewhere:
  - min contrast is judged against a fixed 3, while the gate defaults to 4 and runs from 0 to 7, so a result of 3.5 under a gate of 4 shows "ok";
  - from-surface is judged against a fixed 0.25;
  - a gate set to 0 (off) can still paint its stat red.

  The verdict should read the constraint that was asked for.
- evidence: read
- severity: low

## "Copy as tokens" emits duplicate keys when a pinned anchor shares a name with a generated swatch
- where: apps/theme-editor/src/PalettePreview.tsx:91 (tokenJson)
- scenario: pin the crayon "red" (anchor name `red`), or a hex whose `hueName` is `yellow`. `generate` names the free swatches with `uniqueNames` over the free hues only (packages/theme/src/engine/color/generate.ts:194-196), so a free red hue is also named `red`. The copied JSON then holds `"swatch-red"` twice. A JSON reader keeps only the last one, so a color is silently dropped. Names should be unique across anchors and generated swatches before they become keys.
- evidence: read
- severity: low

## The New theme dialog reopens with the last name and its stale error
- where: apps/theme-editor/src/ThemeWorkbench.tsx:109-110 and 364-386 (ThemeWorkbench, New theme dialog)
- scenario: open New theme, type `Bad Name` and press Create, which shows the error "Use lowercase letters…". Press Cancel, then reopen the dialog. It shows `Bad Name` and the same error before anything is typed, because `newName` and `newProblem` are never reset when the dialog closes or opens. It should open empty, with no error.
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
apps/theme-editor/src/palette/crayons.ts
apps/theme-editor/src/palette/legoColors.ts
apps/theme-editor/src/palette/unmetGates.ts
apps/theme-editor/src/presets.ts
apps/theme-editor/src/theme/api.ts
apps/theme-editor/src/theme/draft.ts
apps/theme-editor/src/theme/draftStorage.ts
apps/theme-editor/src/theme/entries.ts
apps/theme-editor/src/theme/exportFiles.ts
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

Read only in part: apps/theme-editor/src/palette/copicColors.ts (generated data, header and first rows), apps/theme-editor/src/theme/fixtures.ts (first 30 lines).

<!-- done: 6 findings, files read: 48 -->