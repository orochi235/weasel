---
"@weasel-js/core": patch
"@weasel-js/history": patch
"@weasel-js/diagram": patch
---

Themes can be edited. `forkTheme`, `setThemeValue` (by a `ThemePath` such as
`['roles', 'accent', 'fill']` or `['series', 2]`), `addThemeRole`, `renameThemeRole`, and
`removeThemeRole` return a new theme and leave the one given alone, so a shipped theme is never
changed; `editableTheme` forks a shipped theme and passes a custom one through. `DiagramTheme` takes
`roleLabels`, the names of roles beyond the shipped six, and `themeRoles(theme)` lists every role
with its name. A removed role's shapes are drawn in the default role. `parseDiagramTheme` and
`themeToJson` read and write `.weasel-theme.json` files, and a bad file comes back as errors naming
each bad value by its path. `applyDiagramTheme` takes `{ coalesceKey, from }`.

Applying a theme whose font size differs from the scene's moves existing text by the step between
them: shape rows, titles, and connector labels keep their offset from the body size.
`setDiagramFontSize(scene, ids, size)` sets a shape's or connector's text size by hand and records
it in the trait's new `ownFont` (`FontField`), which a theme's size change then leaves and choosing
a role keeps.

Core's `scene.batch(label, fn, { coalesceKey })` folds a batch into the undo entry before it when
that one was recorded under the same key and nothing came between, so a run of batches, such as a
color dragged, undoes as one entry back to the state before the first. Unlike an op's own key it
needs no `coalesceWindowMs`; `scene.history.seal()` ends the run. `@weasel-js/history`'s
`recordEntry` takes the same `coalesceKey`.

weaselchart's Format › Theme › Edit Theme… opens a Theme panel: every role's colors, with roles
added, renamed, and removed (not the default), the connector, label, container, lane, page, and
series colors, and the font. The Style panel gains Text size. The chart recolors as a color is dragged, and one undo takes back the
drag. The first edit to a shipped theme copies it into the chart as "<name> (edited)". Import
Theme… and Export Theme… move a theme between charts.
