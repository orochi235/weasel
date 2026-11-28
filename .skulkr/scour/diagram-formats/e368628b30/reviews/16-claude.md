## DOT reader leaves HTML entities literal in plain (quoted) labels, where Graphviz decodes them
- where: packages/diagram-formats/src/dot/values.ts:36 (labelLines)
- scenario: `a [label="Fish &amp; Chips"]` or `label="&#169; 2026"` → node line reads `Fish &amp; Chips` / `&#169; 2026`; Graphviz's `make_label` runs `htmlEntityUTF8` over every non-HTML label, so it draws `Fish & Chips` / `© 2026`. Only HTML labels (`<...>`) go through `decodeEntities`. Same for edge labels, `taillabel`/`headlabel`, cluster and graph labels, all of which go through `labelLines`. The writer has the mirror gap: a line whose text is literally `&amp;` is written raw and Graphviz draws `&`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/dot/values.ts, packages/diagram-formats/src/graphRead.ts
- size: function
- cause: entity decoding applied to HTML labels only
- confidence: likely

## DOT HTML labels decode only six named entities
- where: packages/diagram-formats/src/graphRead.ts:33 (NAMED / decodeEntities)
- scenario: `label=<caf&eacute; &mdash; &copy;>` → line reads `caf&eacute; &mdash; &copy;`; Graphviz supports the full HTML 4 entity table and draws `café — ©`. Any named entity beyond amp/lt/gt/quot/apos/nbsp is left as written.
- evidence: read
- severity: low
- size: line
- cause: incomplete named-entity table
- confidence: sure

## DOT writer drops a graph page's notation, layout, and each connector's router with no warning
- where: packages/diagram-formats/src/dot/write.ts:150 (writeDot)
- scenario: a `notation: 'class'` page with `layout: { name: 'tree' }` and edges with `router: 'orthogonal'`/`'bezier'` → DOT text carries none of them, reads back as a flowchart page with default layout and default routers, and `warnings` is empty. `ExportResult.warnings` is documented as "what it could not carry out of the diagram"; every other loss in `graphOut`/`writeDot` (ports, marks, trims, routes, pools, groups) gets a sentence.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/graphWrite.ts (graphOut) or dot/write.ts
- size: function
- cause: missing warnings for unwritten page/edge fields
- confidence: likely

## sortedPage's id sort ties distinct ids under localeCompare, so equal pages can compare unequal
- where: packages/diagram-formats/src/testing/samePage.ts:5 (byId)
- scenario: the pbt fixture's `idText` draws from `ODD`, which includes U+200B; ids `a` and `a​` (or other canonically-equivalent / ignorable-only differences) compare 0 under ICU `localeCompare`, so the stable sort keeps input order. Two pages holding the same nodes listed in different orders then sort to different arrays and a round-trip property fails spuriously (or depends on host locale). Member lists use plain `.sort()`, which does not have this problem.
- evidence: read
- severity: low
- size: line
- cause: locale collation used as a total order
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

<!-- done: 4 findings, files read: 39 -->
