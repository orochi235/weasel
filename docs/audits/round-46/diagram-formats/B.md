I couldn't write `.skulk/out/findings.md`: the write needed a permission that was never granted. As the brief allows, the whole document is below. Two notes on the tree: HEAD is `782733b19c`, not the stated `6438325…` (that object isn't in this clone), and `fromScene.ts`, `sceneReaders.ts` and `toScene.ts` have uncommitted, type-only changes. I reviewed the working tree as it stands.

# Audit round 46: diagram-formats findings

## A shape's header row, and its aside, disappear when written to DOT, Mermaid flowchart or draw.io XML
- where: packages/diagram-formats/src/rowLines.ts:8-12 (rowLines), through graphWrite.ts:47 (nodeLines) and dot/write.ts:33
- scenario: a class-notation node has `rows: [{ kind: 'header', text: 'Order' }, { kind: 'field', label: 'id', value: 'int' }]`, which is what `readShape` produces whenever the body has a header band. `rowLines` keeps only `label` and `field` rows. A `header` row goes to `dropped()`, so the written label is just `id: int`: the class name and the header's `aside` are lost. The warning given is "port rows and slots were dropped", which describes something else. A header row holds text and should be written as the first line.
- evidence: read (`Row` union in diagram/src/body.ts:21-44; rowLines.test.ts covers dividers only)
- severity: medium

## DOT color names are read and written as CSS names, but Graphviz resolves them as X11, so several common names change color
- where: packages/diagram-formats/src/dot/values.ts:56-64 (dotColor); dot/read.ts:38-41 (colorAttr); graphWrite.ts:123-130 (hexColor, used by dot/write.ts:24)
- scenario: Graphviz's default color scheme is X11. `color=green` there is #00ff00, `gray`/`grey` is #bebebe, `maroon` is #b03060 and `purple` is #a020f0. `dotColor` returns a bare name, and a `/x11/` prefix, unchanged, and paint then reads it as CSS: green becomes #008000, gray #808080, and so on. Writing has the same problem in reverse: `hexColor` passes CSS names through, so a node stroked CSS `green` is drawn by Graphviz in X11 green. Only names under the `/svg/` scheme should pass through as CSS. Names where X11 and CSS disagree need mapping on read, and should be written as hex.
- evidence: read
- severity: medium

## addTemplatePage draws a new page in the night theme even when the scene names another
- where: packages/diagram-formats/src/templates/templateScene.ts:30-44 (addTemplatePage) → toScene.ts:128 (pageSpecs)
- scenario: a scene opened in `paper` (`diagram:theme` = 'paper') calls `addTemplatePage(scene, PAGE_TEMPLATES.flowchart)` with no `opts.theme`. `pageSpecs` falls back to `diagramThemeFrom(undefined)`, the night theme, so the new page's nodes, plot colors and sequence come out night-colored inside a paper document. `AddTemplatePageOptions.theme` inherits the doc "Default the one the document names", and here the document is the scene, which `addTemplatePage` already has in hand. It never reads that scene's theme (e.g. `diagramThemeOf(scene)`).
- evidence: read (every test passes `theme` explicitly)
- severity: medium

## scenePageKinds and documentFromScene answer differently for a page holding both a plot root and a sequence root
- where: packages/diagram-formats/src/pageKinds.ts:24-35 (scenePageKinds) vs fromScene.ts:79-83 and 131-136 (documentFromScene)
- scenario: one page holds a sequence root ahead of a plot root in `contentRoots` order. `scenePageKinds(scene, { page })` takes the first kind it meets and answers `{'sequence'}`. `documentFromScene` always checks `plots` first, so it exports the page as a plot page. A menu filtering with `formatFitsKinds` therefore offers formats for a kind the export never produces. Without `opts.page`, the set also includes `'sequence'` for a page that exports as a plot. The two also search different sets: fromScene looks through every `renderOrderNodes` entry, scenePageKinds only `contentRoots`, so a nested plot or sequence root is seen by one and not the other.
- evidence: read
- severity: low

## Diagram JSON accepts a page with no `data`, which crashes later when the document is drawn
- where: packages/diagram-formats/src/jsonFormat.ts:33-39 (read)
- scenario: `{"format":"weasel-diagram","version":2,"pages":[{"kind":"graph","id":"p","width":10,"height":10}]}` reads without error. `documentSpecs` → `prepared` → `needsLayout` then throws `TypeError: Cannot read properties of undefined (reading 'nodes')`. `DiagramFormat.read` promises to throw on text it cannot read, and the reader already refuses a malformed theme and an unknown page kind. A page whose `data` (or `width`/`height`) is missing or not an object is let through.
- evidence: read
- severity: low

## The DOT writer leaves out widths that differ from Graphviz's defaults and node sizes on an unplaced page
- where: packages/diagram-formats/src/dot/write.ts:29-41 (nodeAttrs) and 131-132 (writeDot root `node`/`edge` defaults)
- scenario: per-item attributes are written only where they differ from the page theme (`changed(…, nodeStyleIn(out))`). The root `node [...]` and `edge [...]` statements carry fill, stroke and text color, but not `penwidth`. With the night theme (node strokeWidth 1.5, edge width 2), every shape and connector is written with no width at all, so Graphviz draws them at 1, while the theme colors do carry over. Separately, `width`/`height` are written only when every node is placed. A node with `width`/`height` but no `at` (which `readDot` itself produces from a `width` attribute without `pos`) loses its size on write, with no warning.
- evidence: read (theme values in diagram/src/theme/themes.ts:40-48)
- severity: low

## WriteOptions.page naming a page the document lacks silently writes the first page
- where: packages/diagram-formats/src/document.ts:107-109 (writtenPage), used by graphOut and every one-page writer
- scenario: `writeDot(doc, { page: 'p9' })` on a document whose pages are `p1` and `p2` returns `p1` as DOT with no warning and no error. A caller that names a stale or mistyped page id gets a different page exported as if it were the one asked for.
- evidence: read
- severity: low

## DOT detection rejects files the DOT reader accepts when a `#` line is indented
- where: packages/diagram-formats/src/dot/format.ts:7,15 (COMMENTS, detect) vs dot/lex.ts:37 (lexDot)
- scenario: `"  # generated\ndigraph { a }"`. `lexDot` treats `#` as a comment at any line start after whitespace, because whitespace never clears `lineStart`. The detection regex strips `^#` only at column 0, so `HEADER` fails, `detectFormat` returns null, and `readDocument` rejects the file that `readDot` reads fine.
- evidence: read
- severity: low

## The sortedPage test helper sorts lanes, whose order is meaningful, and never sorts clusters
- where: packages/diagram-formats/src/testing/samePage.ts:8-19 (sortedPage)
- scenario: a reader that reverses a pool's lanes produces a page that `sortedPage` makes equal to the expected one, because lanes are re-sorted by id even though lane order is drawn order. Meanwhile `data.clusters` and their `members` are left in file order, so a reader that only reorders clusters fails a comparison that is meant to ignore order. The first hides a real defect; the second fails on a harmless difference.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/colorCheck.ts
packages/diagram-formats/src/document.ts
packages/diagram-formats/src/dot/format.ts
packages/diagram-formats/src/dot/lex.ts
packages/diagram-formats/src/dot/parse.ts
packages/diagram-formats/src/dot/read.ts
packages/diagram-formats/src/dot/values.ts
packages/diagram-formats/src/dot/write.ts
packages/diagram-formats/src/exportPage.ts
packages/diagram-formats/src/formats.ts
packages/diagram-formats/src/fromScene.ts
packages/diagram-formats/src/graphPageMeta.ts
packages/diagram-formats/src/graphRead.ts
packages/diagram-formats/src/graphWrite.ts
packages/diagram-formats/src/index.ts
packages/diagram-formats/src/jsonFormat.ts
packages/diagram-formats/src/lineError.ts
packages/diagram-formats/src/pageKinds.ts
packages/diagram-formats/src/pageLayout.ts
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

<!-- done: 9 findings, files read: 35 -->