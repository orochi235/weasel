## Class relation to a class whose id starts with `o` reads as an aggregation to a truncated id
- where: packages/diagram-formats/src/mermaid/class/parse.ts:38 (RELATION), written by packages/diagram-formats/src/mermaid/class/write.ts:153 (ClassWriter.relation)
- scenario: a plain association from `a` to a class `obj` (no end head, no cardinality) is written `  a -- obj`. RELATION's optional end head `(\|>|\*|o|>)?` greedily takes the `o`, `\s*` matches nothing, and the to-ID matches `bj`, so the line reads as `a --o bj`: a hollow-diamond edge to a new class `bj`, and `obj` loses the edge. The same happens with `..` and for hand-written Mermaid like `Customer -- Order`. The end head should only be taken when no id character follows it (as the flowchart lexer does with `[ox](?![\p{L}\p{N}_])`).
- evidence: read
- severity: medium

## A note joined to another note is written as `note for <that note>`, and reads back with a phantom class
- where: packages/diagram-formats/src/mermaid/class/write.ts:72 (ClassWriter constructor), :162 (noteLines)
- scenario: two `note` shapes A and B with one edge A→B. The constructor accepts B as A's target because `out.byId.has(B)` is true for any node, so it writes `note for B "…"`. B itself is never written as a class (`node()` skips notes) but as a separate `note "…"`. On read, `note for B` calls `draft(B)`, creating an empty class box named `B`, while B's note text gets a freshly minted `note-n` id. The target should be restricted to nodes that are not notes, with the edge warned as dropped.
- evidence: read
- severity: low

## ER `crow-many` is written as one-or-many with no warning
- where: packages/diagram-formats/src/mermaid/er/write.ts:16 (ENDS)
- scenario: an edge whose markerEnd is `crow-many` (many, with no minimum) is written `|{`, which reads back as `crow-one-many`. That adds a "at least one" constraint the source never had. Every other unmapped end gets a warning in `end()`, but this one changes meaning silently.
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
