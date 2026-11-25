# Audit round 36 — apps.theme-editor.src

## ThemeEditor crashes when the theme list comes back empty
- where: apps/theme-editor/src/ThemeEditor.tsx:64 (ThemeEditor)
- scenario: the dev server's `list()` answers `[]` (an empty or misconfigured themes directory) and no draft is stored → `loaded.themes[0]` is undefined and `current.name` throws a TypeError during render, unmounting the app; it should show an empty state (or offer New theme).
- evidence: read
- severity: low

## Inspect reports tokens from @media / @supports rules that do not currently apply
- where: apps/theme-editor/src/theme/inspect.ts:26 (tokensReadAt)
- scenario: a component stylesheet has `@media (prefers-color-scheme: dark) { .btn { color: var(--wzl-fg-dark) } }` or a `(max-width)` query; with the query not matching, Inspect still lists `fg-dark` among "Tokens read" and jumps to it, because `visit` descends into every grouping rule's `cssRules` without checking `CSSMediaRule.media`/`CSSSupportsRule.conditionText` against the page.
- evidence: read
- severity: low

## The Scales layer throws when the draft does not derive, crashing the workbench
- where: apps/theme-editor/src/layers/ScalesLayer.tsx:41 (ScaleSection) → apps/theme-editor/src/theme/scales.ts:26 (scaleTable)
- scenario: on the Pins layer, edit a pin to a dangling reference such as `{nope}`. The workbench keeps rendering with the last good `derived` (ThemeWorkbench.tsx:137–143, "the editor keeps showing the last one that did") and shows "This draft does not derive". Now click Scales in the rail: `ScaleSection` runs `scaleTable(draft, …)` on the *current* draft, whose `derive(def, selection, lookup)` (and `axisDependencies`/`mergeChain`) throws inside a `useMemo` during render, so the whole app unmounts. Should fall back to the last good derivation, as SemanticsLayer does for `mergeChain` (SemanticsLayer.tsx:33–39).
- evidence: read
- severity: high

## "Compare in preview" throws during render once the draft stops deriving
- where: apps/theme-editor/src/ThemeWorkbench.tsx:181–184 (generatedTheme)
- scenario: on Ramps, press "Compare in preview" on a ramp (sets `focusRamp`), then make an edit that leaves the draft non-deriving (a pin set to `{nope}`, or `extends` a theme not in the lookup). `generatedTheme`'s `useMemo` calls `runtimeTheme(adoptGenerated(draft, …))` → `bakeChain`/`mergeChain` on the bad draft with no try, so the render throws and the app unmounts, while the neighbouring `derived` memo catches the same failure and keeps the last good one.
- evidence: read
- severity: medium

## A literal semantic's number becomes a string when edited in the drawer
- where: apps/theme-editor/src/layers/SemanticDrawer.tsx:144 (RuleFields)
- scenario: a semantic `{ value: 0.5, type: 'number' }` (or any numeric literal) opened in the drawer and edited to `0.6` is written back as `{ value: '0.6' }`, a string, changing the saved definition's JSON type. TokenLayer (seeds) and PinRepair keep a number a number through `keepNumberness` (model.ts:93); the drawer answers the same question the other way.
- evidence: read
- severity: low
