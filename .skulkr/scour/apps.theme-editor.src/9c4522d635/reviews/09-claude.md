# Findings: apps.theme-editor.src

## Click-to-inspect misses every token a component reads through an inline-style custom property
- where: apps/theme-editor/src/theme/inspect.ts:65 (tokensReadAt)
- scenario: Inspect is on, and the user clicks the Slider in the preview's Specimen. The Slider gets `trackHeight="var(--wzl-slider-track-h)"` and `thumbSize="var(--wzl-slider-thumb-size)"`, and `SliderBody.rootVarsOf` writes them as inline `style` (`--rp-track-height: var(--wzl-slider-track-h)`). `tokensReadAt` only walks stylesheet rules (`sheets`) and never reads `el.style`. So `follow('rp-track-height')` finds no winner, or finds a sheet default that the inline declaration overrides, and `slider-track-h` / `slider-thumb-size` never appear under "Tokens read". It can also report a token from a sheet default that the inline value hides. Inline declarations should count, and should beat any non-`!important` sheet declaration for the same element and property.
- evidence: read (packages/ui/src/components/Slider/SliderBody.tsx:28-31 sets the vars as inline CSSProperties; inspect.ts gathers winners from `sheets` only)
- severity: medium
- fix: apps/theme-editor/src/theme/inspect.ts
- size: function
- cause: cascade model ignores the style attribute
- confidence: sure

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

<!-- done: 1 findings, files read: 50 -->
