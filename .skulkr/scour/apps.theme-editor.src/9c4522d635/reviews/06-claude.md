## A token only a parent theme pins is listed on no layer page, and a jump to it opens Pins, which does not list it
- where: apps/theme-editor/src/theme/model.ts:69 (layerNames), apps/theme-editor/src/theme/model.ts:61 (jumpLayerFor)
- scenario: Open `child` (extends weasel). weasel pins `radius-md` as a pin-only token. derive gives it provenance `{ layer: 'pins', pinned: false }` (packages/theme/src/engine/derive.ts:120). The Pins page lists only `def.pins`, so it leaves the token out. The Seeds/Ramps/Scales/Semantics/Components pages filter on `provenance.layer === layer`, so they leave it out too. The token can't be seen or edited anywhere, and the rail counts skip it. Inspecting a component that reads `--wzl-radius-md` calls `jump`, and `jumpLayerFor` falls through to `provenance.layer`, which is `'pins'`. That switches to the Pins page, which has no row to highlight. The token should show (as inherited) on the page the jump opens.
- evidence: read (derive.ts:118-120 confirms the provenance shape)
- severity: medium
- fix: apps/theme-editor/src/theme/model.ts, apps/theme-editor/src/theme/entries.ts
- size: function
- cause: Pins page limited to own pins while pin-only tokens are classed under 'pins'
- confidence: likely

## A reference typed into a theme-prefs string field turns the field into a badge mid-edit and drops focus
- where: apps/theme-editor/src/TokenReference.tsx:40 (TokenReference)
- scenario: A string token holds a plain value, so `refer` gives undefined and the bare `PrefControl` is drawn with `open` false. The user types `var(--wzl-fg)`. As soon as the value parses as a reference, the next render swaps the text field for the Badge and Edit button, and the caret is lost. Appending ` 2px` or fixing a typo needs a click on Edit first. The `onChange` only records `editing` when `open` is already true, so typing that starts in the plain field is never held. The doc says the field stays "until focus leaves it", and that should hold here too.
- evidence: read
- severity: low
- size: line
- cause: editing state recorded only when already open
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
