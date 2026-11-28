## Click-to-inspect ignores inline `style` declarations, which outrank every stylesheet rule
- where: apps/theme-editor/src/theme/inspect.ts:72 (tokensReadAt)
- scenario: a kit component in the preview sets a property or a custom property in its `style` attribute (e.g. `style={{ '--thumb-color': 'var(--wzl-accent)' }}` or `background: var(--wzl-x)`). `tokensReadAt` only walks `sheets`' rules, so a token read through the inline declaration is never reported, and a stylesheet declaration the inline one overrides is reported as the winner, listing a token the element does not actually read. The cascade gives the style attribute precedence over all non-`!important` author rules; it should be seeded into `winners[i]` from `el.style` (or `getAttribute('style')`) with a specificity above any selector.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/inspect.ts
- size: function
- cause: cascade model omits the style attribute
- confidence: likely

## Click-to-inspect counts declarations inside an unmet `@container` (or `@scope`/`@starting-style`) rule
- where: apps/theme-editor/src/theme/inspect.ts:77 (tokensReadAt, `applies`)
- scenario: `applies` tests only `CSSMediaRule` and `CSSSupportsRule`; every other grouping rule returns true and its nested rules are visited. A component styled with `@container (min-width: 40rem) { .x { color: var(--wzl-fg-strong) } }` inside a narrow preview pane has that declaration counted, and by source order it can beat the declaration actually in force, so the inspector lists `fg-strong` and jumps to it although the element reads something else. Unmet conditional rules other than media/supports should not contribute (or, where untestable, should not override a declaration known to apply).
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/inspect.ts
- size: line
- cause: conditional-rule check covers only media and supports
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
