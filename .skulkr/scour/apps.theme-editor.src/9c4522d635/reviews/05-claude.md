## A draft left for a theme whose file was deleted becomes an undiscardable "theme" that can only fail to reload
- where: apps/theme-editor/src/ThemeEditor.tsx:23 (withUnsavedDrafts), apps/theme-editor/src/ThemeWorkbench.tsx:220 (dead-draft actions)
- scenario: theme `foo` is saved (draft stored with `baseHash: "<sha>"`), then `foo.json` is deleted on disk. On load, `withUnsavedDrafts` re-adds `foo` from its draft with `hash: ''`, and `start` is the stored draft, so `baseHash` is the old sha, not null. The workbench treats it as on-disk: the dead-draft screen offers only "Discard the draft and reload from disk", whose `api.get('foo')` throws; the healthy screen offers no discard at all, and a save with the stale base hash answers a conflict whose "Reload from disk" fails the same way. The theme cannot be dropped from the UI. Should: a theme not in `listed` with `hash === ''` is treated as unsaved (baseHash null / discard offered) whatever its draft says.
- evidence: read
- severity: medium
- fix: apps/theme-editor/src/ThemeEditor.tsx
- size: function
- cause: draft's baseHash trusted over the list
- confidence: likely

## TokenLayer's jump-to-token builds an unescaped attribute selector, which throws on a token name containing `"` or `\`
- where: apps/theme-editor/src/TokenLayer.tsx:35 (TokenLayer effect)
- scenario: a definition pins a token whose key contains a double quote or backslash (pins are user-keyed); inspecting or jumping to it sets `highlight`, and `querySelector('[aria-label="a"b"]')` throws a SyntaxError inside the effect, taking the editor down. Should escape with `CSS.escape` (or compare `aria-label` values without a selector).
- evidence: read
- severity: low
- fix: apps/theme-editor/src/TokenLayer.tsx
- size: line
- cause: unescaped user string in selector
- confidence: likely

## tokensReadAt never reads rules from `@import`ed sheets
- where: apps/theme-editor/src/theme/inspect.ts:84 (tokensReadAt, visit)
- scenario: a stylesheet that pulls in component CSS with `@import` has a `CSSImportRule` whose rules live on `rule.styleSheet.cssRules`, not `rule.cssRules`; `visit` recurses only through `cssRules`, so every token read by an imported sheet's declarations is missing from Inspect's list. Should visit `rule.styleSheet` (subject to its media) as well.
- evidence: read
- severity: low
- size: line
- cause: CSSImportRule not followed
- confidence: likely

## A reference field being edited closes mid-typing when the store normalizes what was set
- where: apps/theme-editor/src/TokenReference.tsx:32 (TokenReference)
- scenario: the field stays open only while `Object.is(editing.value, ctx.value)`. `onChange` records the raw typed value, then `ctx.setValue(value)`; a store whose validator coerces or trims (or rejects) the value hands back a different `ctx.value`, so `open` turns false, the text field is swapped for the reference chip, and focus is lost on the keystroke. Should hold open on the value the leaf reports after the write, or until blur.
- evidence: read
- severity: low
- size: function
- cause: open-state keyed on pre-write value
- confidence: likely

## Scale parameter sliders clamp a theme's own value outside their fixed ranges
- where: apps/theme-editor/src/layers/ScalesLayer.tsx:22 (PARAMS)
- scenario: a theme's own scale with `base: 96`, `step: -2` or `ratio: 4` renders a slider bounded to 0–64 / 0–32 / 1–3; the thumb shows the bound, and the first touch writes a value inside the range, silently replacing the authored one (a negative step can never be written). Should widen the range to include the current value, or show an out-of-range value as text as non-numeric ones are.
- evidence: read
- severity: low
- size: function
- cause: fixed slider bounds over free-form data
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

<!-- done: 5 findings, files read: 50 -->
