# Findings: apps.theme-editor.src

## The app root never pins `overflow: hidden`, and the narrow workbench grows the document
- where: apps/theme-editor/src/app.css:1 (html, body, #root)
- scenario: `html, body, #root` get `height: 100%` and `margin: 0` but no `overflow: hidden`, and no labkit stylesheet sets it either (no `overflow` rule anywhere under `packages/labkit` matching `*.css`). At a viewport ≤ 900px, `ThemeEditor.module.css` switches `.workbench` to `height: auto`, so the rail, the editor and the preview stack at their full heights and the document itself scrolls instead of each pane scrolling inside its own box. The repo rule is that the root fills the viewport exactly and `scrollY` stays 0.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/app.css, apps/theme-editor/src/ThemeEditor.module.css
- size: line
- cause: root overflow not pinned
- confidence: likely

## TokenLayer builds a CSS selector from a token name without escaping it
- where: apps/theme-editor/src/TokenLayer.tsx:36 (TokenLayer effect)
- scenario: a jump to a token runs `querySelector(`[aria-label="${first}"]`)`. Token names come from the definition's own keys (pins, components), which a definition file or the pin repair screen can spell with a `"` or `\`. A name like `a"b` makes the selector invalid, `querySelector` throws a SyntaxError inside the effect, and the workbench crashes instead of scrolling. `CSS.escape(first)` (or matching `aria-label` by comparison) avoids it.
- evidence: read
- severity: low
- size: line
- cause: unescaped selector value
- confidence: likely

## A pinned semantic with no generated value shows a blank "Rule produced" cell
- where: apps/theme-editor/src/theme/semantics.ts:107 (semanticRows)
- scenario: `produced: text(p.pinned ? p.generated?.value : token.value)`. When a pin covers a semantic whose rule produced nothing at that selection (for example a rule with no branch for the mode), `p.generated` is undefined and `text(undefined)` returns `JSON.stringify(undefined)`, which is `undefined`, not a string. SemanticDrawer then renders an empty `<code>` where every other missing value shows `—`, and the `produced: string` type is violated.
- evidence: read
- severity: low
- fix: apps/theme-editor/src/theme/semantics.ts, apps/theme-editor/src/layers/SemanticDrawer.tsx
- size: line
- cause: JSON.stringify(undefined) is not a string
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

<!-- done: 3 findings, files read: 50 -->
