## Click-to-inspect never reports tokens reached through a custom property set in an inline style
- where: apps/theme-editor/src/theme/inspect.ts:96 (tokensReadAt, `follow`)
- scenario: In the theme editor, turn on Inspect and click the slider in the preview. ThemePreview's Specimen passes `trackHeight="var(--wzl-slider-track-h)"` and `thumbSize="var(--wzl-slider-thumb-size)"`, and SliderBody writes them as inline `--rp-track-height` / `--rp-thumb-size` (packages/ui/src/components/Slider/SliderBody.tsx:30-31). Slider.module.css reads `height: var(--rp-track-height, 24px)` and `width: var(--rp-thumb-size, 14px)`. `follow('rp-track-height', i)` searches only the `winners` built from stylesheet rules, finds no declaration, and stops, so `slider-track-h` and `slider-thumb-size` never show in "Tokens read" and the jump never reaches them. It should read each chain element's `style` declarations too, ranked above stylesheet rules that are not `!important`.
- evidence: read
- severity: medium
- size: function
- cause: inline style declarations left out of the cascade model
- confidence: sure

## A negative px value in a scale draws a full-width ladder bar
- where: apps/theme-editor/src/layers/ScalesLayer.tsx:126 (ScaleSection)
- scenario: Take a scale whose steps resolve to a negative length, such as a tracking or offset scale with `-1px`. `pxOf` accepts the minus sign and returns -1. The bar then gets `width: -N%`, which is invalid CSS, so the browser drops it. The bar is `display: block` with no width, so it spans the whole cell: the most negative step draws as the widest bar. `widest` also ignores magnitude, so a scale whose values are all negative gets `widest = 1`. The bar should scale by `Math.abs(px)` against the widest magnitude.
- evidence: read
- severity: low
- size: line
- cause: signed value used as a width
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
