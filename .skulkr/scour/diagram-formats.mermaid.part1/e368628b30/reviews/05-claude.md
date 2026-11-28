## Flowchart reader drops a plain node whose id is also an edge id, leaving a dangling edge
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:91 (MermaidReader.mention)
- scenario: `flowchart TD\n A e1@--> B\n e1 --> C`. `mention` treats every shapeless mention of `e1` as edge metadata, whether or not it carries `@{…}`, so it warns "edge metadata was dropped" and creates no node `e1`. `walk` still calls `link(…, 'e1', 'C')`, and `graphPage` keeps the edge, so the page holds an edge from a node that does not exist. Only a mention that carries `meta` should be read as edge metadata. The writer can produce this input itself: it runs node and edge ids through one `mermaidIds` call and writes `e1@` when an edge id equals a node id.
- evidence: read (graphPage at graphRead.ts:144 keeps edges as given)
- severity: medium
- fix: packages/diagram-formats/src/mermaid/flowchart/read.ts
- size: line
- cause: edge-meta test does not require `ref.meta`
- confidence: likely

## Class and ER writers drop `header` rows without a warning
- where: packages/diagram-formats/src/mermaid/class/write.ts:20 (classParts); packages/diagram-formats/src/mermaid/er/write.ts:24 (entityParts)
- scenario: a node with `rows: [{ kind: 'header', text: 'Order' }, { kind: 'label', text: 'id' }]`. `classParts` only collects `label` and `field` rows, so the header is skipped: the class is named `node.id`, or after the first label, and no warning is given. `entityParts` filters rows to `label`/`field` in the same way, so the entity's name becomes the first label. `smallLines` (c4/kinds.ts) and `nodeLines` count a header as a text line, so the same row means two different things in two places.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/mermaid/class/write.ts, packages/diagram-formats/src/mermaid/er/write.ts
- size: function
- cause: row kinds handled inconsistently with nodeLines
- confidence: likely

## Block diagram reader accepts `columns 0` and `block:id:0` without a warning; the writer drops them
- where: packages/diagram-formats/src/mermaid/block/read.ts:121 (BlockReader.walk, columns branch)
- scenario: `block-beta\n columns 0\n a b`. The parser reads n=0 and `walk` sets `top = 0`, which the grid layout then clamps to 1 with no warning. Writing that page back, `gridCount` drops the 0 and warns "whole numbers from 1". So the reader and writer disagree about whether 0 is a valid count, and the read gives no warning for a value the page does not honor.
- evidence: read (grid.ts:122 clamps with Math.max(1, …))
- severity: low
- fix: packages/diagram-formats/src/mermaid/block/read.ts
- size: line
- cause: no validation of counts on read
- confidence: sure

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
