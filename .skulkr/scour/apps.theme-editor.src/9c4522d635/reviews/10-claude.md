## An inherited pin-only token appears on no layer page, and an inspect jump to it lands on a Pins page that does not list it
- where: apps/theme-editor/src/theme/model.ts:63 (layerNames), apps/theme-editor/src/theme/model.ts:54 (jumpLayerFor)
- scenario: a theme extending weasel (every theme `starterDefinition` makes) inherits weasel's pins. derive gives a token only a pin produces the provenance `{ layer: 'pins', pinned: false }` (derive.ts:120). `layerNames('pins', …)` lists only `Object.keys(def.pins)`, the child's own pins, and every other layer keeps a name only when `provenance.layer === layer`, so no page lists an inherited pin-only token. Its counts are missing from the rail too. When Inspect picks a component that reads such a token, `jumpLayerFor` sees `pinApplies` true but no own pin and returns `provenance.layer`, which is `'pins'`. The editor switches to Pins, nothing there matches the highlight, and nothing scrolls into view. What should happen: the token is listed somewhere, as the jumpLayerFor doc promises ("where an inherited pin shows beside what it overrides"), or the Pins page also lists the inherited pins that apply.
- evidence: read (model.ts layerNames/jumpLayerFor; packages/theme/src/engine/derive.ts:118-120; weasel.json has a `pins` key)
- severity: medium
- fix: apps/theme-editor/src/theme/model.ts, apps/theme-editor/src/TokenLayer.tsx
- size: function
- cause: Pins page filters to own pins, the other pages to their producing layer
- confidence: likely

## Inspect never counts tokens read by `::before` / `::after` rules
- where: apps/theme-editor/src/theme/inspect.ts:36 (specificityAt), apps/theme-editor/src/theme/inspect.ts:10 (matches)
- scenario: a kit control draws part of itself in a pseudo-element, for example `.switch::before { background: var(--wzl-…) }` for a thumb or a checkbox mark. `el.matches('.switch::before')` is false for the element, so `specificityAt` drops the rule and `tokensReadAt` leaves out the token the visible part reads. With Inspect on, clicking the Switch or Checkbox in the preview lists only the host element's tokens, and the jump skips the token the user actually sees. What should happen: match the selector with its pseudo-element stripped and count its declarations for that element.
- evidence: read
- severity: low
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
