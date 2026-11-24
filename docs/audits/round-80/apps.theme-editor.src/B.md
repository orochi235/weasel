# Audit round 80 — apps.theme-editor.src

## tokensReadAt follows custom-property declarations that a later or more specific rule overrides
- where: apps/theme-editor/src/theme/inspect.ts:38 (tokensReadAt, `holds.set`)
- scenario: `.btn { --btn-bg: var(--wzl-accent) }` and `.btn.ghost { --btn-bg: transparent }`, with `background: var(--btn-bg)`. Inspecting a ghost button reports `accent` as a token it reads, and the workbench jumps to it, though the cascade gives `--btn-bg: transparent`. The same happens when the target redeclares a custom property an ancestor also declares: both elements' declarations go into one `holds` map with no specificity or order. It should follow only the declaration that wins for the element that reads it.
- evidence: read
- severity: low

## The declaration regex splits values that contain `;` inside a string or url
- where: apps/theme-editor/src/theme/inspect.ts:2,36 (DECLARATION over `rule.style.cssText`)
- scenario: `mask: url("data:image/svg+xml;utf8,<svg …>")` or `content: "a;b"`. `[^;]*` ends the value at the inner `;`, and the next match starts inside the string, so a property name is invented from the rest of the value. That can record wrong reads or holds. Iterating `rule.style` (item / getPropertyValue) avoids reparsing cssText.
- evidence: read
- severity: low

## SemanticsLayer gives the drawer ramps from the last derived draft, but its rule and axes from the current draft
- where: apps/theme-editor/src/layers/SemanticsLayer.tsx:27-33 (`ramps` from `derived.merged`, `chain` from `draftChain`)
- scenario: The draft fails to derive mid-edit (a reference typed half-way), so `derived` is the last good version, while `chain` merges the current draft. A ramp the draft added or renamed since then is missing from the drawer's Ramp options and from `stepOn`/`defaultRule`. Meanwhile the drawer's rule and axes come from the newer `chain`, which can already reference that ramp. The Ramp select then shows a value that is not among its options, and changing the kind picks a ramp from the stale list. Both should come from the same source (`chain`).
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

<!-- done: 3 findings, files read: 50 -->
