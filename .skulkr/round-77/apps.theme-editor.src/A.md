# Audit round 77 — apps.theme-editor.src (blind reviewer)

## Editing a pin in the token layers drops its `description` and `scope`
- where: apps/theme-editor/src/TokenLayer.tsx:52 (write)
- scenario: a draft holds `pins: { 'radius-md': { value: '6px', type: 'dimension', description: 'card corners', scope: ['density'] } }`. Editing the value in the Pins (or Components) layer builds a fresh `{ value, type, alpha }` and writes it over the old leaf with `writeAt`, so `description` and `scope` (both `PinObject` fields, `packages/theme/src/definition.ts:12-16`) vanish from the definition, and are saved that way. The edit should replace only `value` (spreading the existing leaf at `selection`, as `PinRepair`'s `plain().write` does with `{ ...pin, value }`). `type` is also overwritten from the derived token rather than kept from the pin.
- evidence: read
- severity: medium

## Ramp and scale editors read their parameters from the last derivation, not the draft, when the draft does not derive
- where: apps/theme-editor/src/layers/RampsLayer.tsx:172 (RampsLayer, `derived.merged.ramps`), apps/theme-editor/src/layers/ScalesLayer.tsx:153 (ScalesLayer, `derived.merged.scales`)
- scenario: type a dangling reference into a pin so the draft stops deriving (the workbench keeps showing `lastGood`), then open Ramps and drag "Curve". Each tick writes the new curve into the draft via `setRamp(draft, …)`, but the slider's `value` comes from `entry`, taken from the stale `derived.merged`, so the slider snaps back to the old value on every render while the draft keeps changing underneath; GatesEditor and the Scales sliders do the same, and ramps/scales added or made own since the last good derivation are missing or shown as inherited. SemanticsLayer answers the same question the other way (`mergeChain(draft, lookup)` with a fallback to `derived.merged`, SemanticsLayer.tsx:33), so the two layers disagree on which definition an editor reads.
- evidence: read
- severity: medium

## Unpinning a swatch removes every anchor sharing its name
- where: apps/theme-editor/src/SwatchPanel.tsx:118 (unpin)
- scenario: anchor names are only made unique by `add`; a restored live state or a saved preset goes through `anchorsOf` (presets.ts:90), which does not dedupe, and AnchorList's `recolor` keeps a name while changing the color. With anchors `[{name:'red', hue:28,…}, {name:'red', hue:10,…}]`, clicking the pinned "red" crayon calls `unpin('red')`, which filters out both anchors instead of the one whose color matched. `pinnedByColor` also keeps only the last name per color. Unpin should remove the anchor matched by color (or by index), not by name.
- evidence: read
- severity: low

## "Copy as tokens" writes swatch names into JSON unescaped
- where: apps/theme-editor/src/PalettePreview.tsx:95 (PalettePreview, tokenJson)
- scenario: anchored swatches take the anchor's name, and a stored or preset anchor's name can be any string (`anchorsOf` accepts any `typeof name === 'string'`). An anchor named `my "brand"` or containing a backslash produces `"swatch-my "brand"":` — invalid JSON on the clipboard. The key should go through `JSON.stringify`.
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

<!-- done: 4 findings, files read: 50 -->
