# Findings: apps.theme-editor.src

## Inspect-jump to an inherited pins-only token opens the Pins page, which does not list it
- where: apps/theme-editor/src/theme/model.ts:66 (jumpLayerFor)
- scenario: The draft is a child of weasel (like `fixtures.ts`'s `child`). Inspect a component that reads a token weasel only pins, which the child does not pin itself (one of the `radius-*` pins other than `radius-md`). derive records it as `{ layer: 'pins', pinned: false }` (packages/theme/src/engine/derive.ts:120). `jumpLayerFor` skips the own-pin branch, because the child does not hold the pin, and falls through to `provenance.layer`, which is `'pins'`. `layerNames('pins')` lists only `def.pins` (model.ts:79), so the workbench switches to a Pins page with no row for the token, and nothing is highlighted or scrolled to. The token also appears on no other page. Expected: the jump lands on a page that lists the token, or the Pins page lists inherited pins that apply.
- evidence: read
- severity: medium
- fix: apps/theme-editor/src/theme/model.ts
- size: function
- cause: the jump target and the page listing disagree about inherited pure pins
- confidence: likely

## Turning "Varies by <axis>" off and on again rewrites a non-mode variation as a mode variation
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:186 (setVaries)
- scenario: A semantic rule is `{ by: 'density', comfortable: …, compact: … }`. The drawer labels the toggle `Varies by density` (`axis = rule.by`). Turn it off, and the rule collapses to the current branch. Turn it back on: `setVaries(true)` always writes `{ by: 'mode', …modeValues }`, so the rule now varies by mode rather than density, and a toggle that just read "Varies by density" has silently changed axis. Expected: turning it back on restores a variation over the axis it was turned off from.
- evidence: read
- severity: low
- size: function
- cause: axis hard-coded to 'mode' when re-enabling
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

<!-- done: 2 findings, files read: 50 -->
