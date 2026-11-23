## readArchitecture hangs on a group cycle that does not pass through the first group checked
- where: packages/diagram-formats/src/mermaid/architecture/read.ts:102 (readArchitecture, the "would hold itself" loop)
- scenario: `architecture-beta` / `group a(cloud)[A] in b` / `group b(cloud)[B] in c` / `group c(cloud)[C] in b`. All three groups exist, so the `in` check passes. The cycle check runs over the statements in order and starts with `a`: `up` walks b → c → b → c … through `r.parent`, and never equals `a`, so the `for` loop never ends and the import hangs. It should throw "group … would hold itself" (it does if `b` or `c` happens to be checked first). The walk needs a visited set, or the check should throw on any repeated `up`.
- evidence: read
- severity: high

## The class diagram reader emits a node and a container with the same id when a namespace and a class share a name
- where: packages/diagram-formats/src/mermaid/class/read.ts:131 (readClassDiagram, `containers` built from `r.namespaces`)
- scenario: `classDiagram` / `namespace Shapes {` / `class Circle` / `}` / `Shapes <|-- Circle`. The relation drafts a class `Shapes` (a node with id `Shapes`), and the namespace becomes a container whose id is also `Shapes`. The page then holds two items under one id. The flowchart reader resolves the same collision by renaming the container (`subgraphContainerIds`). Block and architecture throw on a name given twice (docs/unruled.md, 2026-11-22), and C4 throws through `claim`. So this decision is made several different ways, and the class reader produces a page with duplicate ids.
- evidence: read
- severity: medium

## Files read
packages/diagram-formats/src/mermaid/architecture/parse.ts
packages/diagram-formats/src/mermaid/architecture/read.ts
packages/diagram-formats/src/mermaid/architecture/write.ts
packages/diagram-formats/src/mermaid/block/parse.ts
packages/diagram-formats/src/mermaid/block/read.ts
packages/diagram-formats/src/mermaid/block/write.ts
packages/diagram-formats/src/mermaid/c4/kinds.ts
packages/diagram-formats/src/mermaid/c4/parse.ts
packages/diagram-formats/src/mermaid/c4/read.ts
packages/diagram-formats/src/mermaid/c4/write.ts
packages/diagram-formats/src/mermaid/class/parse.ts
packages/diagram-formats/src/mermaid/class/read.ts
packages/diagram-formats/src/mermaid/class/write.ts
packages/diagram-formats/src/mermaid/common/header.ts
packages/diagram-formats/src/mermaid/common/lines.ts
packages/diagram-formats/src/mermaid/common/meta.ts
packages/diagram-formats/src/mermaid/common/number.ts
packages/diagram-formats/src/mermaid/common/styles.ts
packages/diagram-formats/src/mermaid/common/text.ts
packages/diagram-formats/src/mermaid/er/parse.ts
packages/diagram-formats/src/mermaid/er/read.ts
packages/diagram-formats/src/mermaid/er/write.ts
packages/diagram-formats/src/mermaid/flowchart/lex.ts
packages/diagram-formats/src/mermaid/flowchart/parse.ts
packages/diagram-formats/src/mermaid/flowchart/read.ts
packages/diagram-formats/src/mermaid/flowchart/write.ts
packages/diagram-formats/src/mermaid/format.ts
packages/diagram-formats/src/mermaid/gantt/parse.ts
packages/diagram-formats/src/mermaid/gantt/read.ts
packages/diagram-formats/src/mermaid/gantt/write.ts
packages/diagram-formats/src/mermaid/gitgraph/parse.ts
packages/diagram-formats/src/mermaid/gitgraph/read.ts
packages/diagram-formats/src/mermaid/gitgraph/write.ts
packages/diagram-formats/src/mermaid/journey/read.ts
packages/diagram-formats/src/mermaid/journey/write.ts

<!-- done: 2 findings, files read: 35 -->
