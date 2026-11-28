## A scene of a diagram type with no notation (network, bpmn, orgChart) reopens as a flowchart after any document round trip
- where: packages/diagram-formats/src/fromScene.ts:132 (documentFromScene), packages/diagram-formats/src/toScene.ts:150 (typeOfGraphs)
- scenario: a scene whose `diagram:type` is `network` (catalog.ts declares no `notations` for network, bpmn, orgChart) → `documentFromScene` asks `diagramNotationOf(s)`, which falls back to `FLOWCHART_NOTATION`, so the page gets no `notation` → write as Diagram JSON and read it back → `documentSpecs` → `typeOfGraphs` → `diagramTypeOfNotation(undefined)` = the flowchart type → the scene opens with `diagram:type` flowchart and flowchart stencils. The native format is said to carry everything the model holds, but the type is lost. `graphTemplate` (templates/catalog.ts:37) has the same gap: a network template page carries `notation: 'flowchart'`, so `documentSpecs` of it alone would also name flowchart (templateSpecs hides this by overwriting the doc key).
- evidence: read (diagram/src/diagramTypes/catalog.ts: network/bpmn/orgChart have no `notations`; doc.ts:46-53)
- severity: medium
- fix: packages/diagram-formats/src/document.ts, packages/diagram-formats/src/jsonFormat.ts, packages/diagram-formats/src/toScene.ts
- size: design
- cause: diagram type carried only through page notation, which some types lack
- confidence: likely

## Diagram JSON with two pages of one id passes `read` and then throws when drawn
- where: packages/diagram-formats/src/jsonFormat.ts:56 (read)
- scenario: `{"format":"weasel-diagram","version":2,"pages":[{"id":"p",...},{"id":"p",...}]}` → `read` returns a document with no warning → `documentSpecs` → `layoutPages` throws `layoutPages: two pages have the id "p"`. The reader's contract is to throw on text it cannot read; this one fails later, outside the format, with a core message. Ids also share one namespace across the document, which is likewise unchecked.
- evidence: read (core/src/core/pages/pages.ts:70)
- severity: low
- size: function
- cause: page id uniqueness not validated
- confidence: sure

## Diagram JSON accepts a cluster with no `members` list, which every graph writer then throws on
- where: packages/diagram-formats/src/jsonFormat.ts:41 (pageProblem)
- scenario: a v2 graph page with `"clusters":[{"id":"g"}]` passes `pageProblem` (only `hasId` is checked) → `DIAGRAM_DOT.write` / Mermaid write → `clusterTree` runs `for (const m of g.members)` (graphWrite.ts:87) → `TypeError: g.members is not iterable`. A string `members` on a container iterates its characters as member ids.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/jsonFormat.ts
- size: line
- cause: member lists not validated
- confidence: likely

## DOT reader warns that compass port `c` was dropped, though it names the center, the same as no port
- where: packages/diagram-formats/src/dot/read.ts:243 (portOf)
- scenario: `a:c -> b` or `tailport=c` → port undefined, compass `c` → not `_`, not in `COMPASS_PORTS` → listed under "DOT ports a diagram does not have were dropped: a:c", though the edge reads exactly as Graphviz draws it (center = unset).
- evidence: read
- severity: low
- size: line
- cause: `c` not treated like `_`
- confidence: sure

## A pool nested in a container is left out of the container's members on export
- where: packages/diagram-formats/src/sceneReaders.ts:283 (membersOf)
- scenario: a pool placed inside a container (authoredScene's `parent` allows it) → `readRegion` for the container lists only shapes and role-`container` regions, so the pool is not a member → reimported, the pool sits outside the container and the container fits without it.
- evidence: read
- severity: low
- size: line
- cause: role filter excludes `pool`
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
