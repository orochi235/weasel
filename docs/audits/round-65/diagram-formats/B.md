# Audit round 65 — diagram-formats (blind reviewer)

## A Graphviz HTML label's `<BR ALIGN="…"/>` breaks no line, so its lines run together
- where: packages/diagram-formats/src/graphRead.ts:52 (markupLines), reached from packages/diagram-formats/src/dot/values.ts:20 (htmlLines)
- scenario: `digraph { a [label=<one<BR ALIGN="LEFT"/>two>] }`. Graphviz's HTML-like `<BR/>` takes an `ALIGN` attribute (CENTER, LEFT, RIGHT), and `<BR ALIGN="LEFT"/>` is the usual way to left-align lines in a record-style HTML label. `markupLines` only turns `/<br\s*\/?>/gi` into a newline, i.e. a `<br>` with no attributes. `<BR ALIGN="LEFT"/>` falls through to the strip-every-tag pass, so the node reads as the single line `onetwo`, with no space between the words. It should read as `['one', 'two']`. The same regex serves Mermaid's `<br>`, where an attribute (`<br class=x>`) loses the break the same way.
- evidence: read
- severity: medium

## dotColor drops X11 colors Graphviz draws, such as `red3`, `steelblue1` and `navyblue`, while its doc says it reads X11 as Graphviz draws it
- where: packages/diagram-formats/src/dot/values.ts:73 (x11Color), :88 (dotColor)
- scenario: `digraph { a [style=filled, fillcolor=lightblue2, color=red3] }`. `x11Color` knows only the five names that differ from CSS, plus `grayN`/`greyN`. Every other X11-only name comes back unchanged, `tryParseColor` refuses it, and `checkedColor` drops it with "DOT colors a diagram cannot draw were dropped". That covers the numbered variants of every hue (`red1`–`red4`, `skyblue3`, `lightblue2`, … are common in real DOT files) and the X11-only names (`navyblue`, `violetred`, `lightgoldenrod`). The node loses its fill and stroke, though Graphviz draws both. The doc on `dotColor` says "a bare or X11 name as Graphviz's X11 scheme draws it". `colorCheck.test.ts:22` pins `lightgoldenrod` as dropped, so the test asserts the gap rather than a decision; nothing in `docs/unruled.md` rules it.
- evidence: read
- severity: medium

## laidOutPage grows a partly placed page only right and down, so nodes layout places above or left of the pinned ones fall off the page
- where: packages/diagram-formats/src/pageLayout.ts:87-93 (laidOutPage)
- scenario: a graph page (Diagram JSON, or any reader that keeps some `at`s) where node `a` has `at: {x: 10, y: 10}` and `b`, an edge's tail into `a`, has none. With `placedAny` true, `by` is `{0, 0}`, and only `right`/`bottom` feed the page's new width and height; `min` is never used. Layered layout ranks `b` before the pinned `a`, so `b`'s box lands at a negative y (or a negative x with direction `right`). The page keeps its old top-left, so `b` is drawn off the page onto the pasteboard. After `placeOnPages` and export it may be assigned to whichever page `pageHolding` picks. The page should grow to hold every laid-out box, or everything should be shifted so the smallest x and y sit at least `PAGE_MARGIN` inside, as the nothing-placed branch does.
- evidence: read (whether layered layout places an unpinned node before a pinned one at a negative coordinate is inferred, not run)
- severity: low

## The Diagram JSON reader checks pages and theme but not `crossPageEdges`, so a malformed one throws a TypeError later, far from the read
- where: packages/diagram-formats/src/jsonFormat.ts:44-71 (read)
- scenario: a `.diagram.json` with `"crossPageEdges": {}` (or a `null` entry, or a page whose `name` is a number). `read` validates each page's id, size and data, and the theme, as ruled on 2026-11-20 ("refusing at read, not failing at draw time"), then passes `crossPageEdges` through untouched. Later, `documentSpecs` runs `[...data.edges, ...crossPageEdges]` and throws "not iterable". `graphOut` runs `(doc.crossPageEdges ?? []).some(…)` and throws "some is not a function". A numeric page `name` reaches `dotId(page.name)` → `id.replace` and throws there. The file should be refused at read with a reader error, as a bad page is.
- evidence: read
- severity: low

## scenePageKinds with no page list ignores `opts.page`, where the one-page write of the same scene throws
- where: packages/diagram-formats/src/pageKinds.ts:25 (scenePageKinds)
- scenario: a scene with no page run, and `scenePageKinds(scene, { page: 'p2' })`. Because `placed.length === 0`, the `opts.page` branch is skipped and `{graph}` comes back. `documentFromScene` of that scene makes the single page `page-1`, so `writtenPage(doc, { page: 'p2' })` (and DOT or Mermaid `write`) throws a `RangeError`. The 2026-11-20 ruling says `scenePageKinds` throws for an `opts.page` its scene has no page for, as `writtenPage` does. Here the two answer the same question differently: the menu offers a format whose write then throws. It should test `opts.page` against the stand-in `page-1` too.
- evidence: read
- severity: low

## DOT detect claims text whose keyword runs into a name, which the reader then refuses
- where: packages/diagram-formats/src/dot/format.ts:8 (KEYWORD), :13 (hasHeader)
- scenario: `detect('digraphs {}')` or `detect('graphite { }')`. `KEYWORD` (`/^\s*(?:strict\s+)?(?:di)?graph\s*/i`) matches `digraph` or `graph` with no word boundary, and `ID` then takes the rest of the word (`s`, `ite`) as the graph id, so detect returns true. The lexer reads `digraphs` as one name, and `parseDot` throws `expected "graph" or "digraph"`. `detectFormat` picks DOT for text that isn't DOT, ahead of the formats later in the list, and `readDocument` rejects a file another format might have read. The keyword needs a boundary (`\b` or a required space or `{`).
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

<!-- done: 6 findings, files read: 36 -->
