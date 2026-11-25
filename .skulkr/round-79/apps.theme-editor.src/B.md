# Audit round 79 — apps.theme-editor.src

## Editing a list-valued literal or pin as text turns the list into a string, where PinRepair keeps it a list
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:157-162 (RuleFields, literal branch); apps/theme-editor/src/TokenLayer.tsx:64 (write); apps/theme-editor/src/theme/model.ts:117-122 (tokenValueFromText)
- scenario: a literal semantic rule `{ value: ['Inter', 'sans-serif'] }` with no `type`, or one typed `shadow` or any other type besides `cubicBezier`/`fontFamily`. The drawer shows it with `serializeTokenValue(rule.type ?? '', …)`, giving `Inter, sans-serif`. Any edit goes through `tokenValueFromText(rule.type, …)`, which calls `parseTokenValue(type ?? 'string', raw)`, and that returns the raw text for every type except those two (packages/theme/src/dtcg/value.ts:65-77). So one keystroke rewrites the array as the string `"Inter, sans-serif"`. PinRepair answers the same question differently: `listType` (PinRepair.tsx:19-20) infers `cubicBezier` or `fontFamily` for an untyped list and parses back into a list. The text-to-value conversion has two definitions that disagree, and the main editor's version loses the list.
- evidence: read (app code plus packages/theme/src/dtcg/value.ts); the round-trip is traced by reading the code, not run
- severity: medium

## TokenReference stays a text field for good once Edit is clicked
- where: apps/theme-editor/src/TokenReference.tsx:28-31 (TokenReference)
- scenario: a `string` pref whose value refers to a token shows as a link badge. Clicking "Edit … as text" sets `editing` to true, and nothing ever sets it back: not blur, not a commit, not the value changing, not an undo. After the user types a new reference, or undoes back to the old one, the row keeps showing the raw text field instead of the link to the token, until something remounts the row. It should go back to the reference view once the edit ends or the value changes from outside.
- evidence: read
- severity: low

## unmetGates gives the hue gap 0.01° of slack while every other gate is checked exactly
- where: apps/theme-editor/src/palette/unmetGates.ts:27 and :44 (unmetGates)
- scenario: `gateVerdict` is deliberately exact, and its comment says why: "any slack here calls a gate met beside a palette marked infeasible". The hue-gap check uses `stats.minHueGap < floor - 0.01`, and so does the pinned-pair check. If a palette is infeasible only because its hue gap misses the floor by less than 0.01°, `unmetGates` returns `[]`. PaletteLab then shows the generic "Loosen a gate or ask for fewer colors." (and GatesEditor "Loosen a gate.") without naming the gate that bound. This assumes the generator checks the hue floor exactly, as the comment says it does for the other gates; I inferred that and did not check the generator.
- evidence: read (app side); inference (the generator's tolerance)
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

<!-- done: 3 findings, files read: 50 -->
