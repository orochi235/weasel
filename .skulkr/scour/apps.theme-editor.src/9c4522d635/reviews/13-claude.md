# Findings: apps.theme-editor.src

## Click-to-inspect never reports tokens a component reads through an inline custom property
- where: apps/theme-editor/src/theme/inspect.ts:91 (tokensReadAt)
- scenario: In the theme editor, turn Inspect on and click the specimen Slider. `Slider` writes `thumbSize`/`trackHeight` as inline custom properties on its root (`style="--rp-thumb-size: var(--wzl-slider-thumb-size); --rp-track-height: var(--wzl-slider-track-h)"`, pinned by `Slider.metrics.test.tsx:24`). The stylesheet rules read `var(--rp-thumb-size)`, and `follow('rp-thumb-size', i)` looks for a declaration only among the `winners` built from `document.styleSheets`. It finds none, so `slider-thumb-size` and `slider-track-h` are never listed under "Tokens read", and a click cannot jump to them. An element's `style` attribute is a declaration in force, and it beats every stylesheet rule for that property. It should be folded into each chain element's winners (as the highest-ranked, non-important layer).
- evidence: read
- severity: medium
- fix: apps/theme-editor/src/theme/inspect.ts
- size: function
- cause: inline style declarations left out of the cascade
- confidence: likely

## Click-to-inspect drops every rule whose selector targets a pseudo-element
- where: apps/theme-editor/src/theme/inspect.ts:13 (matches / specificityAt)
- scenario: Inspect a specimen Button. Its gloss is drawn by `.button::before { opacity: calc(var(--wzl-button-gloss, 1) * var(--wzl-gloss)) }` (packages/ui/src/components/Button/Button.module.css:75). `Element.matches('.button::before')` returns false (or throws in jsdom, which the catch turns into false), so `specificityAt` returns null for the rule and its declarations never enter `winners`. `button-gloss` and `gloss` are never reported as read, even though changing them visibly changes the clicked button. It should match the selector with its trailing pseudo-element stripped, counting it against the element that owns the pseudo-element.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/inspect.ts
- size: function
- cause: pseudo-element selectors never match an element
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
