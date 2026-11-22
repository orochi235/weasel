# Audit round 71 — diagram-formats — reviewer findings

## DOT reader reads a hand-written `pos` (inches, pinned with `!`) as points
- where: packages/diagram-formats/src/dot/read.ts:178 (positions)
- scenario: a neato-style input `a [pos="0,0!"]; b [pos="2,0!"]` (Graphviz reads input `pos` in inches; only layout *output* is in points) → `!` is stripped and the values taken as points, so `b` is placed 2pt from `a` and the two default-sized nodes (54pt wide) overlap almost completely. Should scale input positions by 72 (at least when no `bb` says the file is layout output, or when the `!` pin marks it as input).
- evidence: read
- severity: medium

## Graphviz's `empty` and `onormal` arrowheads (the same arrow) read as two different markers
- where: packages/diagram-formats/src/dot/values.ts:134 (ARROWS), :139 (ARROW_NAMES)
- scenario: Graphviz documents `empty` as a synonym of `onormal` (a hollow triangle). `ARROWS` maps `empty` → `'arrow-open'` (an open chevron) and `onormal` → `'triangle-hollow'`, so `a -> b [arrowhead=empty]` and `a -> b [arrowhead=onormal]` import as different markers; and the writer writes `arrow-open` as `empty`, which Graphviz draws as a hollow triangle, not a chevron. The other documented synonyms (`open` = `vee`, `ediamond` = `odiamond`, `invempty` = `oinv`) are missing and fall to the "drawn as arrows" warning.
- evidence: read (Graphviz synonym list from its arrowType documentation; not run)
- severity: low

## DOT cluster with `style=invis` is still drawn as a container
- where: packages/diagram-formats/src/dot/read.ts:246 (readCluster), :322 (readDot)
- scenario: `subgraph cluster_a { style=invis; x; y }` → Graphviz draws no box (members drawn); the reader makes a visible container with the theme's fill and stroke and no warning, while invisible nodes and edges are left out with a warning (unruled.md 2026-11-22). The cluster's `invis` is dropped silently.
- evidence: read
- severity: low

## `weasel_outline` is taken unvalidated, so an empty or unknown value becomes the node's outline
- where: packages/diagram-formats/src/dot/read.ts:152 (readNode)
- scenario: `a [weasel_outline=""]` or `a [weasel_outline=blob]` → `str(...)` is `''`/`'blob'`, `??` keeps it, and the node's `outline` is a string that is no `Outline` (the `outlineOf` fallback and its "read as rectangles" warning are skipped). Should fall back to the shape (and warn) when the name is not a known outline.
- evidence: read
- severity: low

## `tailport=""`/`headport=""` warns that a port was dropped
- where: packages/diagram-formats/src/dot/read.ts:195 (portOf)
- scenario: `a -> b [tailport=""]` (Graphviz's unset) → `attr` is `''`, not a compass and not `_`, so it becomes `port: ''`, and the reader lists `a:` under "DOT ports a diagram does not have were dropped", where every other attribute reads `""` as unset (`keyword`, `colorAttr`).
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

<!-- done: 5 findings, files read: 38 -->
