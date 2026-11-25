# Audit round 77 — apps.theme-editor.src

## Anchor lightness field's 0.3–0.97 bounds (and 0.01/1° steps) don't cover the lightness a pinned hex really has
- where: apps/theme-editor/src/AnchorList.tsx:47 and :60 (AnchorList, the `h` and `L` NumberFields)
- scenario: pin Copic "0" `#ffffff` (L = 1.0), Copic "100" `#1e1d22` or LEGO "Dark Brown" `#372100` (L ≈ 0.2) from SwatchPanel. `anchorFromHex` keeps the exact lightness, but the L field's `minValue={0.3} maxValue={0.97} step={0.01}` can't hold it. react-aria's NumberField commits a clamped, step-snapped value on blur, so tabbing through the row rewrites L to 0.97 or 0.30 (and hue 87.3 to 87). That changes the pinned color with no edit, and it contradicts the component's own doc ("A pinned color keeps its own lightness"). The bounds should cover what `anchorFromHex` can produce (0–1, hue 0–360), or the field should not snap.
- evidence: read (bounds, and hex sources with L outside them). That react-aria clamps on blur is inferred from its documented commit behavior, not run.
- severity: medium

## Unpinning a grid swatch removes every anchor with that name, not just the one pinned
- where: apps/theme-editor/src/SwatchPanel.tsx:111 (unpin) with :105–106 (pinnedByColor / pinnedName)
- scenario: a state restored from storage or a saved preset holds two anchors with the same name. `anchorsOf` (presets.ts:96) does not dedupe names, and AnchorList's recolor keeps the name. Clicking the pinned swatch calls `unpin(name)`, and that filters out every anchor of that name, including one of a different color. Unpin by identity (the color, or the index) instead of by name.
- evidence: read
- severity: low

## Stored constraints keep any string for an enum field such as `order`
- where: apps/theme-editor/src/presets.ts:79–83 (constraintsOf)
- scenario: a stored live state or preset with `c.order: "random"` passes the `typeof value === typeof fallback` test and goes straight to `generate`. The function's doc says it validates each field against its default's kind, but `order` is an enum, and a stale or hand-edited value is never checked against the values the generator understands. The toggle in ConstraintsPanel then shows no option selected.
- evidence: read
- severity: low

## `fitted` undercounts the size it trims, so a saved history can end up over budget
- where: apps/theme-editor/src/historyStorage.ts:62–73 (fitted)
- scenario: each cut subtracts only `JSON.stringify(cut).length`. It ignores the comma that separated the cut entry and the `floor`/`droppedEntries` fields growing. After k cuts the real size is up to about k characters over `budget`, while the loop believes it fits. Re-measuring `JSON.stringify(out).length` at the end (or per cut) would keep the cap honest.
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
