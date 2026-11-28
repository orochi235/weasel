## A C4 relationship with a technology and no label loses its technology on a round trip
- where: packages/diagram-formats/src/mermaid/c4/write.ts:103 (C4Writer.rel)
- scenario: `Rel(a, b, "", "HTTP")` reads (c4/read.ts:117) as label `[HTTP]`, with no leading text and no space before the `[`. The writer splits the label with `/^(.*?)(?: \[([^\]]*)\])?$/`, which needs a space before `[`, so it gets m[1] = `[HTTP]` and m[2] = undefined. It writes `Rel(a, b, "[HTTP]")`: the technology argument becomes the label, and a later read sees no technology. It should write `Rel(a, b, "", "HTTP")`. Boundaries are not affected, because their labels always have a title before ` [type]`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/c4/write.ts, packages/diagram-formats/src/mermaid/c4/read.ts
- size: line
- cause: the reader and writer split the label differently when it has no text before the technology
- confidence: sure

## A flowchart node that shares an edge id is never created when it is mentioned without a shape, so its edges are left dangling
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:91 (MermaidReader.mention)
- scenario: `flowchart TD` / `A e1@--> B` / `e1 --> C`. `e1` is in edgeIds. Its mention has no shape, so `mention` returns early with "Mermaid edge metadata was dropped." and creates no node and places nothing. But `walk` still calls `link(…, 'e1', 'C')`, so the page gets an edge from `e1` to `C` with no node named `e1`. Any classes on that mention are also dropped. The early return should apply only to a mention carrying `@{…}` metadata (`ref.meta !== undefined`). A bare mention in a chain should make the node, or the edge should be dropped with a warning.
- evidence: read
- severity: medium
- size: line
- cause: the edge-metadata check is keyed on the id alone, not on whether the mention has metadata
- confidence: likely

## Architecture and block writers rename ids their own readers accept (`a-b`, `1x`), with no warning
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:27 (ArchWriter constructor); packages/diagram-formats/src/mermaid/block/write.ts:40 (BlockWriter constructor)
- scenario: An architecture diagram with `service api-gw` reads with id `api-gw`, since parse.ts's ID allows `-` and a leading digit. On write, `mermaidIds(…, { unicode: true })` checks ids against `/^[\p{L}_][\p{L}\p{N}_]*$/u`, so `api-gw` is written as `api_gw` and `1db` as `n1db`. Block's WORD likewise allows `-` and `.` inside an id. The ids silently change on a round trip, and anything outside that holds the old id (a selection, a link, a diff) loses it. The writers should pass `id:` set to the grammar the reader accepts, as the class and ER writers do.
- evidence: read
- severity: low
- size: line
- cause: the writers use the flowchart's id grammar instead of their own reader's
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
