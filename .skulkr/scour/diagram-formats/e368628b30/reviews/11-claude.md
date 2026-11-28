## writeDot looks up `rankdir` on a plain record, so an unknown or prototype-named direction writes an unreadable DOT file
- where: packages/diagram-formats/src/dot/write.ts:140 (writeDot)
- scenario: a graph page whose `direction` is not one of `down/up/right/left` reaches the writer. The JSON reader does not validate `direction`, and neither does `graphPageSettingsOf` on scene page meta. With `direction: "sideways"`, `RANKDIR[page.direction]` is `undefined`, which is `!== null`, so the writer emits `  rankdir=undefined;`. With `direction: "constructor"` it emits `rankdir=function Object() { [native code] };`, and `readDot` then throws `cannot read "("` on the file it was just handed. It should write no `rankdir` for a direction it has no entry for: `getOwn(RANKDIR, …) ?? null`, as every other table in dot/ is read.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/write.ts
- size: line
- cause: prototype-chain lookup on a user-keyed table
- confidence: sure

## A plot or sequence root nested inside a group or container is dropped from the export without a trace
- where: packages/diagram-formats/src/fromScene.ts:108 (documentFromScene)
- scenario: a graph page holds a group containing a sequence diagram's root, or a plot root. `pageRootsOf` counts only outermost content, so the page stays a graph page. In the read loop, `kindOf` returns `'sequence'` for the nested root, and the code hits `continue` without recording it, because `roots.get(page.id)` is not it. A plot root has no diagram trait, so `kindOf` returns `null` and it is skipped too. The sequence or chart vanishes from the document with no warning, because `documentFromScene` has no warnings channel. The same happens to a second sequence on a page whose first sequence made it a sequence page. The documentation says only that such a page "stays a graph page"; it never says the content is lost. A save-and-reopen therefore deletes user content silently.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/pageRoots.ts
- size: design
- cause: nested roots neither exported nor reported
- confidence: likely

## A cross-page edge's world-space waypoints assume the default page layout on import
- where: packages/diagram-formats/src/toScene.ts:55 (graphSpecs) / packages/diagram-formats/src/fromScene.ts:136 (documentFromScene)
- scenario: a scene whose page run uses a non-default page layout (`pagesOf(scene).layout`, which `addTemplatePage` honors) has an edge with one end on the pasteboard and a waypoint. `documentFromScene` writes the waypoint to `crossPageEdges` in that scene's world coordinates, but the document records no page layout. `documentSpecs` places pages with `layoutPages(pageList)` at the default layout and draws `crossPageEdges` unshifted. The pages and their content move, but the waypoint stays where the old layout put it, so the reopened connector bends somewhere off its route. Either the document should carry the page layout, or cross-page routes should be stored relative to a page.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/document.ts, packages/diagram-formats/src/fromScene.ts, packages/diagram-formats/src/toScene.ts
- size: design
- cause: world coordinates without the page layout that produced them
- confidence: likely

## `bb=""` makes DOT `pos` read as points instead of inches
- where: packages/diagram-formats/src/dot/positions.ts:17 (positions)
- scenario: `graph [bb=""]` (Graphviz's "unset") with every node given `pos="1,2"`. `str(root.graph,'bb')` is `''`, not `undefined`, so `unit` becomes 1 and the positions are read as points, 72× too close together. The bb box itself is then ignored because it has length 1. An empty `bb` should count as unset, as `keyword()` treats every other `""` attribute in read.ts.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/read.ts
- size: line
- cause: empty attribute not treated as unset
- confidence: sure

## contentPage measures every root, page structure included
- where: packages/diagram-formats/src/fromScene.ts:37 (contentPage)
- scenario: a scene with a page run but no pages left: `placedPagesOf` gives `[]`, so `contentPage` is used. It takes `scene.roots`, unfiltered, and only drops connectors. The page-run node is a root, so its pose joins the bounds while `renderOrderNodes` filters it out. The made-up page then stretches to the run's box (for example, to the origin), and every exported coordinate shifts by that much. It should filter `isPageStructure` as `inWorld().renderOrderNodes` does.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/fromScene.ts
- size: line
- cause: two filters for one question (which roots are content)
- confidence: likely

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

<!-- done: 5 findings, files read: 39 -->
