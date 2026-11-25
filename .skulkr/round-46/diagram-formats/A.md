## `scenePageKinds` and `documentFromScene` answer "plot or sequence page" two different ways
- where: packages/diagram-formats/src/pageKinds.ts:24-31 (scenePageKinds) vs packages/diagram-formats/src/fromScene.ts:79-83,132-136 (documentFromScene)
- scenario: a page holds both a sequence root and a plot root, the sequence root earlier in `contentRoots` order (e.g. a chart dragged onto a sequence page). `scenePageKinds` claims the page for whichever root comes first (`!claimed.has(page)`), so it reports `sequence`; `documentFromScene` always returns `plots.get(p.id)` first, so the page exports as a `plot` page. A menu asking `formatFitsKinds(format, scenePageKinds(scene, { page }))` then offers or refuses a one-page writer for a kind the document doesn't hold, and the writer throws (`requireGraphPage` / `pageOfKind`) or writes the wrong page. Also, `documentFromScene` runs `plotPageOf` on every node in render order, not just outermost ones (plotPageOf's doc says "the outermost node `root`"), so a plot root nested under a group or container turns the whole page into a plot page and drops its graph content, while `scenePageKinds`, which reads only `contentRoots`, reports `graph`. With no page list, a plot root plus a sequence root give `{plot, sequence}` from `scenePageKinds` while the one content page exports as a plot. Both should apply one rule: outermost roots only, with one precedence.
- evidence: read
- severity: medium

## DOT drops a cluster's dash in both directions, with no warning
- where: packages/diagram-formats/src/dot/write.ts:49-71 (writeCluster); packages/diagram-formats/src/dot/read.ts:232-253 (readCluster), READ.cluster at line 23
- scenario: writing: a container whose style has a `dash` (every container under the shipped themes, `container.dash: [4, 3]`, or its own `colors.dash`) is written with only `style=filled`, `fillcolor`, `color` and `fontcolor`. The dash is lost and nothing warns, though a node's dash is written as `style=dashed`/`dotted` (nodeAttrs line 30). Reading: `subgraph cluster_a { style="dashed" }` gets no dash. `style` is in `READ.cluster`, so `dropUnread` doesn't warn either, and `readCluster` only checks it for `filled`. It should read `dashOf(styles)` and write `dashStyle` the way nodes and edges do, or warn.
- evidence: read
- severity: low

## DOT writes the theme's colors as node/edge defaults but not its widths, so Graphviz draws every stroke at width 1
- where: packages/diagram-formats/src/dot/write.ts:131-132 (writeDot), 38 and 111 (nodeAttrs/edgeLine)
- scenario: under the night theme, nodes have `strokeWidth: 1.5` and edges `width: 2`. `node [...]` and `edge [...]` carry fill, color and fontcolor from `nodeStyleIn(out)` / `edgeStyleIn(out)`, but no `penwidth`. Each item's `penwidth` is written only when it differs from the theme default (`changed(...)`). So a theme-default page draws in Graphviz with the theme's colors but Graphviz's default penwidth 1, and on reading back every node and edge comes without its width. A diagram that sets strokeWidth 1.5 explicitly and one at the theme default write identically only if the default is also written. Add `penwidth` (and the default dash) to the `node`/`edge` default statements as the colors are.
- evidence: read
- severity: low

## `addTemplatePage(scene, template)` draws in the night theme whatever theme the scene is in
- where: packages/diagram-formats/src/templates/templateScene.ts:30-45 (addTemplatePage), via toScene.ts:128 (pageSpecs)
- scenario: a scene whose `diagram:theme` is `paper` calls `addTemplatePage(scene, PAGE_TEMPLATES['plot:pie'])`, the form the package README shows (README.md:89). `pageSpecs` falls back to `diagramThemeFrom(undefined)`, the night theme, so the new chart's or sequence's colors (baked into the specs) are night colors on a paper page. `addTemplatePage` holds the scene and could default to `diagramThemeFrom(scene.doc.get(DIAGRAM_THEME_KEY))`. Neither its doc nor the README says a theme must be passed; only `pageSpecs`'s doc does. (apps/chart passes one, so only direct callers following the README hit it.)
- evidence: read
- severity: low

## DOT `detect` refuses a graph whose id is an HTML string, which `readDot` reads
- where: packages/diagram-formats/src/dot/format.ts:8 (HEADER)
- scenario: `digraph <G> { a -> b }`. `parseDot` takes any `id` token after `digraph`, HTML ones included (parse.ts:87), but HEADER's optional id allows only a name, a numeral or a quoted string, so `detect` is false and `readDocument` throws "is not a diagram file this package reads" for a file the DOT reader parses.
- evidence: read
- severity: low

## `rowLines` drops a header row's text, and warns that port rows and slots were dropped
- where: packages/diagram-formats/src/rowLines.ts:8-12 (rowLines), used by graphWrite.ts:47 (nodeLines) for DOT nodes and Mermaid flowchart nodes
- scenario: a node with `rows: [{ kind: 'header', text: 'Order' }, { kind: 'field', label: 'id', value: 'int' }]`, which `readShape` (sceneReaders.ts:119-123) produces for any shape built with a header band, such as a UML class or an entity stencil. Only `label` and `field` rows are kept. A `header` row falls into `else if (row.kind !== 'divider') dropped()`, so DOT writes `label="id: int"`, the shape's title is gone, and the only warning says "holds only text in a shape; its port rows and slots were dropped", which isn't what was lost. A header holds text (and `aside`) and should be written as a line, the way `label` is.
- evidence: read
- severity: medium

## `hexColor` turns `rgb()` into hex but passes `hsl()`, `oklch()` and `color()` through, which neither Graphviz nor Mermaid reads
- where: packages/diagram-formats/src/graphWrite.ts:123-130 (hexColor)
- scenario: a node with `colors.fill: 'hsl(120, 50%, 50%)'`. `@weasel-js/paint`'s `tryParseColor` reads it, so the diagram draws it and every reader's `checkedColor` accepts it. `hexColor` converts only `/^rgba?\(/`, so DOT writes `fillcolor="hsl(120, 50%, 50%)"`, an unknown color to Graphviz, and Mermaid writes `style a fill:hsl(120, 50%, 50%)`, whose commas split Mermaid's own style list (the reason `rgb()` is converted in the first place). The function's contract is "a CSS color in a spelling every graph format reads". Any color `tryParseColor` reads that isn't a `#hex` or a name should go through `rgbaToHex`, not just `rgb`/`rgba`.
- evidence: read
- severity: medium

## A DOT HTML label laid out over several source lines reads with blank lines in it
- where: packages/diagram-formats/src/dot/values.ts:19 (labelLines) via graphRead.ts:51-54 (markupLines)
- scenario: `a [label=<\n  <b>Bold</b><br/>\n  plain\n>]`, the usual way an HTML label is formatted. Graphviz treats the raw newlines in an HTML string as whitespace, so it draws two lines, "Bold" and "plain". `markupLines` turns `<br/>` into `\n` but also splits on the source's own newlines, giving `['', 'Bold', '', 'plain', '']`, and `labelLines` keeps interior empty lines, so the node reads as `['Bold', '', 'plain']`, with a blank line Graphviz doesn't draw. A table written one `<tr>` per source line comes out the same way, and two cells on one source line (`<td>A</td><td>B</td>`) run together as "AB". For DOT, raw whitespace runs (newlines included) should fold to one space before `<br>` is turned into a break.
- evidence: read
- severity: low

## The Diagram JSON reader passes a page with no `data`, `width` or `height`, which then fails at draw time
- where: packages/diagram-formats/src/jsonFormat.ts:33-39 (read)
- scenario: `{"format":"weasel-diagram","version":2,"pages":[{"kind":"graph","id":"p"}]}` reads without error or warning. `documentSpecs` then throws a bare `TypeError` at `needsLayout` (`page.data.nodes`), and a page with `data` but no `width` places at NaN. The reader already refuses a non-object page, an unknown `kind` and a theme that doesn't check, and unruled.md (2026-11-16) gives the reason: refuse it "rather than taking it as is and failing later". A page missing its `data` object (or `data.nodes`/`data.edges` arrays for a graph) or a finite `width`/`height` should be refused the same way.
- evidence: read
- severity: low

## `readShape` drops a shape's slot rows, image slots included, so even Diagram JSON loses them
- where: packages/diagram-formats/src/sceneReaders.ts:101-124 (readShape)
- scenario: a shape built from `rows: [{ kind: 'label', text: 'A' }, { kind: 'slot', height: 40, image: { src: 'x.png' } }, { kind: 'label', text: 'B' }]`. Its scene keeps the slot: `body.heights` has three entries and the image is a child node (`slotData`, diagram fromData.ts:96-98), and diagram's own `recordedRows` (bodyRelayout.ts:34-44) rebuilds every height-only row as a slot. `readShape` collects only children with string `text` and a numeric `bodyRow`, and there is no field, divider, header or own size, so it returns `lines: ['A', 'B']`. The slot's reserved height and its image are gone from the document, with no warning. That holds in the native Diagram JSON format too ("carries everything the model holds"), so a save/open through `documentFromScene` → `documentSpecs` redraws the shape without its image and with its rows packed. The gaps in `bodyRow` against `body.heights` mark where the slots were.
- evidence: read
- severity: medium

## A shape in both a container and a cluster loses its cluster membership in DOT/Mermaid without a warning
- where: packages/diagram-formats/src/graphWrite.ts:53-62,75-79 (clusterTree, claim)
- scenario: page data with container `k` (members `['a']`) and cluster `g` (members `['a', 'b']`), which the data model allows, since a cluster is drawn around shapes wherever they sit. `claim('a', 'g')` returns at once because `parent.has('a')`. Only the loop case warns, so `g` is written as a cluster holding `b` alone, and the only warning is the general "has no groups; they were written as clusters". Reading the file back gives container `g` without `a`. A member left out of a box should be listed in a warning the way a loop is, or nodes in two clusters are on read (`Membership.place`).
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

<!-- done: 11 findings, files read: 35 -->
