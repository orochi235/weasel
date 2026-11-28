# diagram-formats findings

## documentFromScene strips colors against `opts.theme` but does not record that theme, so writers re-default them from the night theme
- where: packages/diagram-formats/src/fromScene.ts:93 (documentFromScene)
- scenario: a scene with no `diagram:theme` key, exported with `documentFromScene(scene, { theme: paper })`. `readShape`/`readEdge`/`readRegion` drop every color equal to the paper theme's (`ownColors` against `themed`), and the result has no `theme` because `themeValue` is undefined. `graphOut` (DOT, Mermaid) then resolves styles with `diagramThemeFrom(doc.theme)`, which is the night theme, and writes night colors. JSON round-trips the same way, and `documentSpecs` redraws it in night. Every color the author saw in paper is lost. The fix is to set `theme` to `opts.theme`'s id or value when the scene names none.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/fromScene.ts
- size: line
- cause: the theme colors are read against is never written into the document
- confidence: likely

## A color string that is not a parseable color is written into a DOT quoted value without escaping
- where: packages/diagram-formats/src/dot/write.ts:41 (color)
- scenario: `hexColor` returns `css` unchanged when `tryParseColor` fails. A document read from JSON whose node has `colors: { fill: 'a"b' }` (or any color string holding `"` or a trailing `\`) writes `fillcolor="a"b"`. The DOT is then malformed and `readDot` throws on it. Expected: escape the value as `dotId` does (or drop it with a warning).
- evidence: read
- severity: low
- size: line
- cause: unescaped interpolation into a quoted string
- confidence: sure

## Invisible nodes still decide a neato-input page's size and offset after being left out
- where: packages/diagram-formats/src/dot/read.ts:368 (readDot) / packages/diagram-formats/src/dot/positions.ts:22 (positions)
- scenario: a DOT file with no `bb` where every node has `pos`, and one node `style=invis` far from the rest. `positions` computes the page extents and the `llx`/`top` origin from all nodes, the invisible one included. `readDot` drops that node only afterwards, so the page is sized and the visible nodes are offset to make room for something not on it. Expected: filter out invisible nodes before calling `positions`, or exclude them from the extents.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: filter applied after extents computed
- confidence: sure

## Files read
packages/diagram-formats/src/colorCheck.ts
packages/diagram-formats/src/document.ts
packages/diagram-formats/src/dot/format.ts
packages/diagram-formats/src/dot/lex.ts
packages/diagram-formats/src/dot/parse.ts
packages/diagram-formats/src/dot/positions.ts
packages/diagram-formats/src/dot/read.ts
packages/diagram-formats/src/dot/values.ts
packages/diagram-formats/src/dot/write.ts
packages/diagram-formats/src/dot/x11.ts
packages/diagram-formats/src/exportPage.ts
packages/diagram-formats/src/formats.ts
packages/diagram-formats/src/fromScene.ts
packages/diagram-formats/src/graphPageMeta.ts
packages/diagram-formats/src/graphRead.ts
packages/diagram-formats/src/graphWrite.ts
packages/diagram-formats/src/index.ts
packages/diagram-formats/src/jsonFormat.ts
packages/diagram-formats/src/lineError.ts
packages/diagram-formats/src/markReaders.ts
packages/diagram-formats/src/pageKinds.ts
packages/diagram-formats/src/pageLayout.ts
packages/diagram-formats/src/pageRoots.ts
packages/diagram-formats/src/pageSvg.ts
packages/diagram-formats/src/pbt.fixture.ts
packages/diagram-formats/src/plotPages.ts
packages/diagram-formats/src/rowLines.ts
packages/diagram-formats/src/sceneReaders.ts
packages/diagram-formats/src/sequencePage.ts
packages/diagram-formats/src/shiftData.ts
packages/diagram-formats/src/templates/catalog.ts
packages/diagram-formats/src/templates/starters.ts
packages/diagram-formats/src/templates/templateScene.ts
packages/diagram-formats/src/testing/asGraph.ts
packages/diagram-formats/src/testing/authoredScene.ts
packages/diagram-formats/src/testing/docScene.ts
packages/diagram-formats/src/testing/pageScene.ts
packages/diagram-formats/src/testing/samePage.ts
packages/diagram-formats/src/toScene.ts

<!-- done: 3 findings, files read: 39 -->
