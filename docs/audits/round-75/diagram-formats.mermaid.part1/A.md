## Architecture reader hangs on a group cycle that does not pass through the group being checked
- where: packages/diagram-formats/src/mermaid/architecture/read.ts:105 (readArchitecture, self-nesting check)
- scenario: `architecture-beta` / `group a(cloud)[A] in b` / `group b(cloud)[B] in c` / `group c(cloud)[C] in b`. Every `in` names a group, so the check before passes. For `a` (checked first), the loop walks `up = b → c → b → c …` and never reaches `undefined` or `a`, so `readArchitecture` spins forever. It should throw "group … would hold itself" (for `b`/`c`) instead. The loop has no visited set, so it only ends for cycles that pass through `s.id`.
- evidence: read
- severity: high

## C4 and architecture writers drop an edge's dash without a warning
- where: packages/diagram-formats/src/mermaid/c4/write.ts:120 (writeC4, `dropEdgeColors(..., ['stroke','label'])`); packages/diagram-formats/src/mermaid/architecture/write.ts:107 (writeArchitecture, colors check)
- scenario: write a graph page whose edge has `colors: { dash: [4, 4] }` (for example one read from a dotted flowchart or class link) as notation `c4-context` or `architecture`. Neither syntax can hold a dashed relationship or edge, and the line is written as a plain `Rel(...)` / `a:R -- L:b`. The writer warns about stroke, label and width (`dropEdgeColors`'s `EDGE_COLORS` has no `dash` key, and the architecture writer checks only `stroke`/`label`/`width`), but not about the dash. So the dash is silently lost, while every other dropped edge property gets a warning.
- evidence: read
- severity: low

## Block writer silently drops or clamps link widths other than 3
- where: packages/diagram-formats/src/mermaid/block/write.ts:103 (BlockWriter.link)
- scenario: an edge with `colors.width: 2` is written as `--` (the width is lost), and one with `colors.width: 6` is written as `==`, which reads back as width 3. Only stroke and label colors are warned about (line 107), so the width change gets no warning. The flowchart writer keeps the width through `linkStyle … stroke-width`.
- evidence: read
- severity: low

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

<!-- done: 3 findings, files read: 35 -->
