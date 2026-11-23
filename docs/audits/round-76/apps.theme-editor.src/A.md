## Infeasible palette with more anchors than colors is told to "ask for fewer colors"
- where: apps/theme-editor/src/PaletteLab.tsx:105 (PaletteLab, infeasible status) with apps/theme-editor/src/palette/unmetGates.ts:16 (unmetGates)
- scenario: pin 7 anchors at count 8, then drag the Colors slider down to 5 (AnchorList and the slider never stop anchors from outnumbering the count; only SwatchPanel's add does). `generate` leaves out the anchors past `count` and reports `feasible: false` (generate.ts doc, "Anchors past `count` are left out, and the palette is then infeasible too"). No gate is missed, so `unmetGates` returns [] and the banner falls back to "Loosen a gate or ask for fewer colors." That advice makes things worse. The real cause is that there are more anchors than colors, and the fix is more colors or fewer pins, which `unmetGates` never mentions.
- evidence: read
- severity: medium

## A distance gate missed by under 0.005 marks the palette infeasible while every readout says it passes
- where: apps/theme-editor/src/palette/unmetGates.ts:9 (gateVerdict)
- scenario: minDistance = 0.22 and the best attempt reaches 0.217. `meetsGates`/`penalty` in the engine compare exactly, so `palette.feasible` is false. `gateVerdict` subtracts a 0.005 slack, so the Stat turns green ("ok") and `unmetGates` leaves the gate out. The banner then says "No arrangement satisfies these gates" with no gate named, beside a stats row where every gate shows green. The panel and the generator should answer "is this gate met" the same way.
- evidence: read
- severity: medium

## The "would need N° of circle" explanation can never fire
- where: apps/theme-editor/src/palette/unmetGates.ts:34 (unmetGates)
- scenario: `floorDegrees(c)` is `hueFloor * 360 / count`, so `c.count * floor` is `hueFloor * 360`. The slider caps hueFloor at 1, so that is at most 360 and `> 360` is never true. The line meant to explain an impossible hue floor is dead for every value the UI can set. The check needs to account for something else, such as the arc the anchors take up.
- evidence: read
- severity: low

## Clearing a pin that varies by axis drops every branch, while editing it writes only the current one
- where: apps/theme-editor/src/TokenLayer.tsx:47 (TokenLayer write)
- scenario: a pin `{ by: 'mode', dark: …, light: … }` in the Pins layer, viewed at the dark selection. Editing its field goes through `writeAt` and changes only the `dark` branch. Clearing the field (`value === null`) calls `removePin` and deletes the whole pin, including `light`, which was never shown. Two paths on the same field answer "which branch does this edit touch" differently.
- evidence: read
- severity: low

## writeAt replaces a whole axis variation with a leaf when the selection lacks its axis
- where: apps/theme-editor/src/theme/model.ts:126 (writeAt)
- scenario: a seed or pin written `{ by: 'density', … }` where the merged axes declare no `density`, so `fullAxisChoice` leaves it out of the selection. The TokenLayer seeds path does not filter on `leafAt`'s result: it skips only non-scalar leaves. An edit therefore reaches `writeAt`, finds `key === undefined`, and returns the bare leaf, silently discarding every branch. `leafAt` treats the same case as "no value here" (undefined), so the read and the write disagree.
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

<!-- done: 5 findings, files read: 50 -->
