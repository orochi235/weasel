# Audit round 75 — diagram.theme findings

## Setting a header box's text color freezes its header row at the current theme's fill
- where: packages/diagram/src/theme/themeWrites.ts:121 (rowColor), with packages/diagram/src/theme/applyTheme.ts:136 (colorTextNodesOf)
- scenario: a shape with a header (theme has no `headerText` for its role) under `night`; `setDiagramColor(scene, [id], 'text', 'red')`. colorTextNodesOf sends the `text` color only to non-header rows, so the header row keeps night's fill color, which is right. But `ownStyle` now holds `text`, and rowColor leaves a header row alone when `own.has('fill') || own.has('text')`. Then `applyDiagramTheme(scene, paper)`: the box fill becomes white and the band follows paper's dark stroke, but the header row stays `#16222c` (night's fill), so the title is dark on a dark band. A header row the `text` color never reached should keep following the fill. Only `own.has('fill')` should freeze it.
- evidence: read
- severity: medium

## A fill set under a theme with `headerText` leaves the header row stuck at that theme's headerText
- where: packages/diagram/src/theme/themeWrites.ts:119-122 (rowColor), packages/diagram/src/theme/applyTheme.ts:138 (colorTextNodesOf)
- scenario: a custom theme whose role names `headerText: '#fff'`. `setDiagramColor(…, 'fill', 'red')` skips the header row (correct: it shows headerText) and records `ownStyle: ['fill']`. Then applying `paper`, which has no headerText: rowColor returns `undefined` because of `own.has('fill')`, so the header row stays `#fff`. It is not drawn in the author's red fill, as `rowTextColor` (dataColors.ts:43) would draw a shape built with that fill. That is white text on a band that follows the stroke. When the author owns the fill and the new theme has no headerText, rowColor should return the box's own fill color, not leave the row as it was.
- evidence: read
- severity: medium

## Switching to a theme without `header` leaves the previous theme's header band color
- where: packages/diagram/src/theme/themeWrites.ts:128-133 (paintBand)
- scenario: a custom theme whose role has `header: '#ff0000'` is applied, so a header box gets `headerFill` red. Then `applyDiagramTheme(scene, paper)` (shipped themes have no `header`): paintBand returns `{}` because `want === undefined`, so the stale `headerFill` stays. shape.ts:76 draws `headerFill ?? stroke`, so the band stays red instead of following paper's stroke, as `headerFillOf` (dataColors.ts:53) would build it. paintBand should drop `headerFill` when the theme names no band.
- evidence: read
- severity: medium

## setThemeValue writes any value at any path, so an edited theme can be applied but not read back
- where: packages/diagram/src/theme/themeEdit.ts:75-78 (setThemeValue), packages/diagram/src/theme/resolve.ts:69-82 (diagramThemeFrom), packages/diagram/src/theme/applyTheme.ts:69-77
- scenario: `setThemeValue(theme, ['font','size'], 'big')`, `(['font','size'], 0)` or `(['roles','default','fill'], 'notacolor')` all succeed, because the value is typed `string | number` for every path and never checked. `applyDiagramTheme` takes the result as it is: it writes `fontSize: NaN`-like steps or unparseable colors and saves the whole theme as `diagram:theme`. On the next read, `diagramThemeOf` runs `diagramThemeErrors`, rejects it and answers `night`. The picker then shows a theme other than the one drawn, and the next apply's `from` (night, size 12) gives the wrong font step, so text does not move back. Two readers answer "is this a theme" differently. setThemeValue (or applyDiagramTheme) should reject a value the checker would refuse.
- evidence: read
- severity: medium

## diagramThemeFrom silently falls back for an object without `roles`
- where: packages/diagram/src/theme/resolve.ts:80 (diagramThemeFrom)
- scenario: the doc value is a theme object whose `roles` key is missing or misspelled (a hand-edited or truncated theme file stored in the doc). `'roles' in value` is false, so it returns `fallback` without the development warning the docstring promises for "a theme that does not check". Every other malformed theme does warn, via isWholeTheme.
- evidence: read
- severity: low

## setDiagramFontSize accepts sizes a theme step would clamp
- where: packages/diagram/src/theme/applyTheme.ts:195-212 (setDiagramFontSize)
- scenario: `setDiagramFontSize(scene, ids, 0)`, or a negative or NaN size (for example from a cleared number field), writes `fontSize: 0`/`NaN` into every row and relays out the bodies with it, and records `ownFont: ['size']`, so no theme ever repairs it. paintText holds sizes to at least 1, and themeFile rejects a size that is not > 0. This path has no such bound.
- evidence: read
- severity: low

## setDiagramColor('stroke') on a shape with no stroke creates a width-less stroke
- where: packages/diagram/src/theme/applyTheme.ts:181 (setDiagramColor)
- scenario: a body whose data has no `stroke` (an outline drawn with none). `painted(undefined, color)` writes `stroke: { paint: { color } }` with no width or dash. themeWrites/paintBox skips strokes that are absent but now restrokes this one with the theme's width on the next apply, so the shape gains an outline that it was not built with. Inference: I did not check which outlines are built without a stroke.
- evidence: read (the strokeless-outline premise is inferred)
- severity: low

## Files read
packages/diagram/src/theme/applyTheme.ts
packages/diagram/src/theme/fromTokens.ts
packages/diagram/src/theme/resolve.ts
packages/diagram/src/theme/styleField.ts
packages/diagram/src/theme/themeEdit.ts
packages/diagram/src/theme/themeFile.ts
packages/diagram/src/theme/themeFixture.ts
packages/diagram/src/theme/themeWrites.ts
packages/diagram/src/theme/themes.ts
packages/diagram/src/theme/types.ts

<!-- done: 7 findings, files read: 10 -->
