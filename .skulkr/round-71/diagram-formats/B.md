# Audit round 71, area diagram-formats

## The DOT reader treats only a lowercase `cluster` prefix as a cluster, and ignores `cluster=true`
- where: packages/diagram-formats/src/dot/read.ts:122 (DotReader.subgraph), and the matching prefix strip at read.ts:279 (clusterIds)
- scenario: `digraph { subgraph Cluster_A { a b } }`, or `subgraph g { cluster=true; a b }`. Graphviz draws both as clusters: its name check is case-insensitive (`strncasecmp`), and since Graphviz 7 a subgraph carrying `cluster=true` is one too. Here `sub.id.startsWith('cluster')` is case-sensitive and the `cluster` attribute is never read, so both become plain subgraphs. The nodes come back with no container, and `cluster` is reported as an attribute "a diagram does not hold". It should give a container (with the prefix stripped case-insensitively).
- evidence: read (code); Graphviz's rule is from memory of its `is_a_cluster` and attribute docs, not checked against a Graphviz build here
- severity: medium

## `\G` in a cluster label names the root graph, not the cluster
- where: packages/diagram-formats/src/dot/read.ts:263 (readCluster)
- scenario: `digraph G { subgraph cluster_x { label="\G"; a } }`. In a graph or cluster label, Graphviz replaces `\G` with the name of the object that owns the label, here `cluster_x`. readCluster passes `r.graph.id` (`G`) as the graph name, so the container's label reads `G`. It also passes the cluster id as `self`, so `\N`, which Graphviz leaves alone in a graph label, becomes the cluster's name.
- evidence: read (code); Graphviz's substitution rule is from memory of `strdup_and_subst_obj`
- severity: low

## A backslash-newline continuation in a CRLF file is kept in the string, not joined
- where: packages/diagram-formats/src/dot/lex.ts:69 (quotedPart)
- scenario: a DOT file saved with Windows line ends, holding `label="long \⏎ text"` where ⏎ is `\r\n`. The lexer joins lines only for `\` followed directly by `\n`. Here it meets `\` then `\r`, so the generic escape branch keeps `\` and `\r`, and the `\n` goes in raw. labelLines then reads `\r` as an escaped `r` and keeps the raw newline, so the label gets a stray `r`-less carriage return and a line break in the middle. Graphviz reads text-mode CRLF as `\n` and joins the lines.
- evidence: read
- severity: low

## The DOT writer drops a container's own stroke width with no warning
- where: packages/diagram-formats/src/dot/write.ts:62 (writeCluster)
- scenario: a container with `colors: { strokeWidth: 3 }`. `dataRegionStyle` carries the width into `Cluster.style.strokeWidth`, but writeCluster writes only fill, dash, stroke color and text color, and adds no warning. The cluster comes out at Graphviz's default pen. Nodes and edges write `penwidth`. It should write `penwidth` for the cluster (and the reader should take it), or warn.
- evidence: read
- severity: low

## Dash patterns are written as the words `dashed` and `dotted`, so any other pattern changes with no warning
- where: packages/diagram-formats/src/dot/values.ts:166 (dashStyle), used at write.ts:30, :40, :69, :148, :153
- scenario: a node or edge with `dash: [10, 2]` is written `style=dashed` and reads back as `[6, 4]`. Every dash but `[2, 3]` is written as `dashed`, and the export's warnings say nothing. Other lossy cases on this writer (outlines, markers, ports) each warn.
- evidence: read
- severity: low

## A strict graph's merged edge keeps the first statement's ports
- where: packages/diagram-formats/src/dot/read.ts:296 (strictEdges)
- scenario: `strict digraph { a -> b; a:n -> b:s [color=red] }`. Graphviz updates its one `a->b` edge with what the second statement names. strictEdges merges only the second statement's attributes (`e.own`). The ports given on its node references (`tail.compass`, `head.compass`) stay with the first edge's refs, so the edge comes back red but with no ports.
- evidence: read
- severity: low

## DOT detection strips comment markers inside an HTML graph id, and does not follow `+` concatenation, so it disagrees with the lexer
- where: packages/diagram-formats/src/dot/format.ts:7 and :35 (COMMENTS, detect), :9 (ID)
- scenario: `digraph <a//b> { x }` parses with readDot, because the lexer reads an HTML string to its matching `>` with no comment handling. detect first runs COMMENTS over the whole text and removes `//b> { x }`, so hasHeader finds no `{` and detect answers false. `digraph "a" + "b" { x }` also lexes, but the ID regex wants `{` right after `"a"`. In both cases `readDocument` with no file name, or with a non-DOT extension, rejects a file readDot reads.
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

<!-- done: 7 findings, files read: 38 -->
