## A theme with no `header` band leaves the previous theme's `headerFill` on a header body
- where: packages/diagram/src/theme/themeWrites.ts:128 (paintBand)
- scenario: a custom theme whose role sets `header: '#f00'` is applied (or the shape was built under it, `headerFillOf` writes `headerFill`); then a theme whose role has no `header` (every shipped theme) is applied, or `setDiagramStyle` moves the shape to such a role. `paintBand` returns `{}` when `want === undefined`, and `paintBox` spreads `data`, so the old `headerFill` stays; `shape.ts:76` draws `headerFill ?? stroke`, so the band keeps the old theme's red instead of following the new stroke as `NodeStyle.header`'s "Default `stroke`" and `headerFillOf` (which writes none) say. It should drop `headerFill` when the new style names no band.
- evidence: read (themeWrites.ts:108-133, dataColors.ts:53-54, shape.ts:76)
- severity: medium

## A text color set by hand freezes a header row's text, which that color never reaches
- where: packages/diagram/src/theme/themeWrites.ts:120 (rowColor)
- scenario: a shape with a header has `ownStyle: ['text']` (from `colors.text` in data, or `setDiagramColor(…, 'text', …)`, which by `colorTextNodesOf` skips the header row). Applying another theme: `rowColor` returns `undefined` for the header row because `look.own.has('text')`, so the header text stays the old theme's fill while the band and body fill take the new theme's. At build time (`rowTextColor`) the header text is `headerText ?? fill` and ignores `text`, so the header should follow the new fill; only an own `fill` should leave it.
- evidence: read (themeWrites.ts:116-122, applyTheme.ts:127-132, dataColors.ts:42-43)
- severity: medium

## After a theme with `headerText`, an author's own fill never comes back to the header text
- where: packages/diagram/src/theme/themeWrites.ts:121 (rowColor)
- scenario: shape with header and `ownStyle: ['fill']` (fill `#123456`). Applying a theme whose role names `headerText: '#fff'` writes `#fff` to the header row. Applying then a theme without `headerText`: `rowColor` returns `undefined` because the author owns fill, so the header text stays `#fff` instead of the author's `#123456`, which `rowTextColor` (headerText ?? fill, fill the author's) draws for the same shape built fresh. Should return the box's own fill color in that case.
- evidence: read
- severity: low

## Theme edits can produce a theme that `diagramThemeFrom` then rejects, so the document drops back to `night`
- where: packages/diagram/src/theme/themeEdit.ts:88 (addThemeRole), :97 (renameThemeRole), :66 (setThemeValue)
- scenario: `renameThemeRole(t, 'accent', '')` (a user clearing the name field) or `addThemeRole(t, '')` writes `roleLabels[id] = ''`; `setThemeValue(t, ['font','size'], 0)` or `['roles','default','fill'], 'notacolor'` likewise accepts any value. `applyDiagramTheme` saves it whole via `themeDocValue`; `diagramThemeOf` runs `diagramThemeErrors` (`roleLabels.accent: missing`, `font.size … is not a size`), fails, and returns the fallback `night` with only a dev warning, so the next edit/draw of the document silently uses another theme. The edit functions should refuse (or normalize) values the checker rejects.
- evidence: read (themeEdit.ts, themeFile.ts:46-47,66-68, resolve.ts:56-79)
- severity: medium

## `setDiagramFontSize` writes any number, including 0, negatives and NaN
- where: packages/diagram/src/theme/applyTheme.ts:191 (setDiagramFontSize)
- scenario: `setDiagramFontSize(scene, ['a'], 0)` (or a NaN from a cleared numeric field) writes `fontSize: 0`/`NaN` to every row and relayouts the body from it; the theme path clamps to 1 (`paintText`), this one does not, and a later theme step moves from the bad value (`NaN + step` stays NaN).
- evidence: read
- severity: low

## `setDiagramColor('stroke')` adds a stroke to a shape drawn with none
- where: packages/diagram/src/theme/applyTheme.ts:161 (setDiagramColor)
- scenario: a shape whose data has no `stroke` (which `paintBox` explicitly leaves strokeless: `data.stroke === undefined ? undefined`) gets `next.stroke = painted(undefined, color)` = `{ paint: { color } }`, a stroke with no width, so it gains an outline at the renderer's default width; the theme path and the hand path decide differently whether a strokeless box has a stroke.
- evidence: read (applyTheme.ts:161, themeWrites.ts:110-111)
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

<!-- done: 6 findings, files read: 10 -->
