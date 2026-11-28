# Findings: apps.theme-editor.src

## A token the theme inherits only as a parent's pin is listed on no page, and Inspect jumps to a page without it
- where: apps/theme-editor/src/theme/model.ts:61 (layerNames), apps/theme-editor/src/theme/model.ts:53 (jumpLayerFor)
- scenario: any theme extending weasel without pinning `radius-md` itself (the starter theme `New theme` creates is one).
  weasel only pins `radius-md` (see `theme/fixtures.ts`: "one over a token weasel only pins"), so in the child's
  derive result `provenance['radius-md'].layer === 'pins'`. `layerNames` lists, for `pins`, only `def.pins` keys (the
  child's own), and for ramps/scales/semantics/components only chain tokens whose provenance layer equals that page —
  so `radius-md` is listed on no page and cannot be seen or pinned from the token pages. Inspecting a component that
  reads `--wzl-radius-md` calls `jump` → `jumpLayerFor` returns `'pins'` (the provenance layer, since the pin is not the
  definition's own), opening the Pins page, which does not list it: nothing highlights, and the jump lands on a page
  unrelated to the token. Its own doc says "otherwise the layer that produced it, where an inherited pin shows beside
  what it overrides" — true for a pin over a rule, false for a pin-only token. Expected: the inherited pin-only token
  listed somewhere (Pins page as inherited, or Components), and the jump going there.
- evidence: read (traced `layerNames`, `jumpLayerFor`, `ownTokenNames`; `packages/theme/src/engine/derive.ts:120` gives a
  pin-only token `{ layer: 'pins', pinned: false }`)
- severity: medium
- fix: apps/theme-editor/src/theme/model.ts, apps/theme-editor/src/theme/entries.ts
- size: function
- cause: Pins page filters to own pins while other pages filter by provenance layer; pin-only inherited tokens fall between
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

<!-- done: 1 findings, files read: 50 -->
