# Audit round 80 — apps.theme-editor.src

## Jumping to a token pinned by a parent theme opens the Pins page, which does not list it
- where: apps/theme-editor/src/ThemeWorkbench.tsx:251 (layerOf, used by jump/inspect and the "Tokens read" links)
- scenario: draft `child` extends `weasel`; weasel pins a semantic (or a pins-only token such as one weasel only pins), and `child` holds no pin on it. Inspect a component reading that token, or click it in "Tokens read". `pinApplies(derived.primary.result, token)` is true, since provenance marks an inherited pin `pinned` (semantics.ts labels exactly these rows "inherited"), so `jump` switches to the Pins layer. That page lists only `Object.keys(def.pins)`, the draft's own pins (model.ts `layerNames('pins', …)`), so the token is absent: nothing highlights or scrolls into view, and the page may say "child has no pins". The jump should go to Pins only for a pin the draft owns (`Object.hasOwn(draft.pins ?? {}, token)`), and otherwise to the provenance layer, where Semantics/Components list inherited tokens.
- evidence: read (ThemeWorkbench.tsx layerOf; model.ts pinApplies, layerNames; semantics.ts semanticRows `pinned` vs `ownPin`)
- severity: medium

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
