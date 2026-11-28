# Findings: apps.theme-editor.src

## A categorical ramp's plain `surface` gate is neither editable nor shown in the gates editor
- where: apps/theme-editor/src/layers/RampsLayer.tsx:118 (GatesEditor)
- scenario: a theme's own categorical ramp has `gates: { surface: '#ffffff' }`. `plain('surface', '#ffffff')` is true (string, same typeof as the default, not a `{ref}`), so the gate goes into `c`, not `held`. `ConstraintsPanel` has no surface row, so in "Edit gates" the gate is invisible. The editor never shows the surface the ramp is gated against, and nothing can change it. The read-only branch does list it (`values` from `entry.gates`). An editable gate the panel has no control for should show as written, like `held`, or get a control.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/layers/RampsLayer.tsx, apps/theme-editor/src/palette/ConstraintsPanel.tsx
- size: function
- cause: plain/held split ignores which keys the panel renders
- confidence: sure

## A pinned semantic with no generated value gets `undefined` as its "Rule produced" text
- where: apps/theme-editor/src/theme/semantics.ts:107 (semanticRows)
- scenario: `produced: text(p.pinned ? p.generated?.value : token.value)`. `text` is `JSON.stringify` for any non-string, and `JSON.stringify(undefined)` returns `undefined`, not a string. So for a pinned token whose provenance has no `generated` (entries.ts:37 treats `pinned && generated === undefined` as a real case), `produced` is `undefined` although `SemanticCell.produced` is typed `string`. SemanticDrawer then draws an empty `<code>` under "Rule produced" where it should show "—", as the Pin column does for a missing value.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/semantics.ts, apps/theme-editor/src/layers/SemanticDrawer.tsx
- size: line
- cause: JSON.stringify(undefined) is not a string
- confidence: likely

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

<!-- done: 2 findings, files read: 50 -->
