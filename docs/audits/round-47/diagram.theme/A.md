# Findings: diagram.theme (round 47, reviewer)

## Applying a theme recolors only, so a scene switched into a theme keeps the old theme's stroke widths, dashes and edge widths, unlike one built in it
- where: packages/diagram/src/theme/themeWrites.ts:87 (paintBox), :174 (themeWrites, connector branch)
- scenario: build a diagram under `paper` (edges `width: 2`, container `dash: [4, 3]`, roles at the default node stroke width), then `applyDiagramTheme(scene, DIAGRAM_THEMES.blueprint)`. `paintBox` and the connector branch spread the old `stroke` and change only `paint.color`, so edges stay 2 wide (blueprint says 1.5), containers keep `[4, 3]` (blueprint `[6, 4]`), and night's `strokeWidth: 1.5` never reaches shapes switched from paper (or leaves them when switching back). The same data built directly under blueprint (`fromData.ts:117`, `edgeStroke.ts:11`) draws blueprint's widths and dashes. The look you get depends on how the scene got into the theme, though `DiagramTheme` holds those values per role, edge, container and lane.
- evidence: read
- severity: medium

## setDiagramStyle / setDiagramColor on a sequence part write a trait the sequence never reads, so the role does not show and a hand color is lost at the next redraw
- where: packages/diagram/src/theme/applyTheme.ts:28 (diagramStyleOf), :95 (setDiagramStyle), :161 (setDiagramColor)
- scenario: a sequence head is built with `diagram: { outline, seq }` (`sequence/specs.ts:66-69`), so `diagramStyleOf` calls it a `shape`. `setDiagramStyle(scene, ['head:a'], 'accent')` writes `style: 'accent'` onto the part. `themeWrites` then skips every `seq` node (themeWrites.ts:170) and `setDiagramStyle` does not call `redrawSequences`, so nothing recolors. The undo entry holds a role change with no visible effect. `setDiagramColor(…, 'fill', c)` does paint the part and records `ownStyle`, but the next `applyDiagramTheme` redraws the sequence from its `SequenceData` and throws the hand color away. A sequence part should either not count as styleable, or have its style edit routed into the sequence's data.
- evidence: read
- severity: medium

## The explicit style edits write locked nodes with a bare `scene.update`, so one locked id throws the whole edit, while `writeAll` in the same file skips locked nodes
- where: packages/diagram/src/theme/applyTheme.ts:103 (setDiagramStyle), :171-174 (setDiagramColor), :195 (setDiagramFontSize)
- scenario: `scene.update` refuses a locked node (`core/scene/fieldEdits.ts:50`, lockGuard throws "cannot update"). `writeAll` checks `scene.isLocked` first (applyTheme.ts:48), but `setDiagramStyle` writes the role trait before `writeAll`, `setDiagramColor` writes the node and its text rows directly, and `setDiagramFontSize` writes `ownFont` directly. Given ids that include a locked shape, or an unlocked shape whose text row is locked, the edit throws partway through the batch instead of skipping the locked node. `setDiagramFontSize`'s own row writes go through `writeAll` and skip it quietly, so the module answers the lock two ways.
- evidence: read
- severity: low

## setDiagramColor('fill') paints a header row's text with the fill even when the theme names `headerText`, and the next theme apply paints it back
- where: packages/diagram/src/theme/applyTheme.ts:122 (colorTextNodesOf) vs packages/diagram/src/theme/themeWrites.ts:100 (rowColor)
- scenario: a custom theme role sets `headerText: '#fff'` (NodeStyle: "A header row's text. Default `fill`"). Calling `setDiagramColor(scene, [id], 'fill', '#123')` on a shape with a header sets the header row's text to `#123`, because `colorTextNodesOf` sends a `fill` color to the header row whatever the theme says. `rowColor` returns `headerText` before it looks at `own`, so the next `applyDiagramTheme` sets the text back to `#fff`. The two functions disagree on whether a hand-set fill reaches a header's text under such a theme, and the hand edit does not survive a theme change, which `ownStyle` promises it will.
- evidence: read
- severity: low

## diagramThemeFrom accepts any object with a `roles` key as a whole theme, and a malformed one crashes the first style lookup
- where: packages/diagram/src/theme/resolve.ts:60 (diagramThemeFrom)
- scenario: a scene snapshot (or any `scene.doc.set`) holds `diagram:theme` as `{ roles: {} }` or with a `defaultRole` it lacks. `diagramThemeOf` returns it unchecked, `defaultRoleStyle` returns `undefined` through its `!` (types.ts:57), and `themeWrites`/`paintBox` throw on `look.style.fill`. A missing `edge` or `font` throws the same way. The 2026-11-16 ruling made the Diagram JSON reader check with `diagramThemeErrors`, but every other way a doc value reaches this function, a scene snapshot included, skips that check. It should check, or fall back to `fallback` with a dev warning as an unknown id does.
- evidence: read
- severity: low

## A theme file passes the check with bad values in the optional fields the engine writes into the scene
- where: packages/diagram/src/theme/themeFile.ts:24 (checker.box), :50 (edge)
- scenario: `box` checks only `fill`, `stroke` and `text`, and `edge` checks only `stroke`. A file with `"roles": {"default": {…, "header": 5, "headerText": null, "strokeWidth": "x", "dash": "a"}}` or `"edge": {"stroke": "#000", "label": 7, "width": -1}` parses without errors. `paintBand` then writes `paint.color: 5`, `rowColor` writes the bad header text color, `roleEdgeStyle` passes `label: 7` to labels, and `fromData`/`edgeStrokeOf` build strokes with a string width or a negative one. `parseDiagramTheme` promises the file is "checked on the way back in", so these fields need checking too.
- evidence: read
- severity: low

## setThemeValue on a role, lane body or series index the theme lacks makes a partial style or a sparse array
- where: packages/diagram/src/theme/themeEdit.ts:41 (setIn), :54 (setThemeValue)
- scenario: `setThemeValue(theme, ['roles', 'new', 'fill'], '#f00')` (any string is a valid `ThemePath` role) adds `roles.new = { fill: '#f00' }` with no stroke or text. `roleStyle` returns it, and `paintBox` writes `paint.color: undefined` into the stroke of every shape in that role. `['series', 20]` on an 8-color series leaves holes 8–19 as `undefined`, and `['lane', 'bodies', 5, 'fill']` makes a hole plus a one-field body. The result also fails `diagramThemeErrors`, so it cannot be saved as a theme file. A missing role should be refused, or filled from the default role as `addThemeRole` does.
- evidence: read
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
