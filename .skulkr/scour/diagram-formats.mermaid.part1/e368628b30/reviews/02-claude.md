# Findings: diagram-formats.mermaid.part1

## Class and ER writers silently drop a box's `header` rows, losing the class/entity name
- where: packages/diagram-formats/src/mermaid/class/write.ts:20 (classParts)
- scenario: a node with `rows: [{ kind: 'header', text: 'Order' }, { kind: 'label', text: 'id: int' }]` written as a class diagram: `classParts` only collects `label` and `field` rows, so the header text is never read. The class name falls back to `node.id`, or to the first label row (`id: int` becomes the name). No warning is raised. `er/write.ts:23` (`entityParts`) filters to `label`/`field` the same way, so an entity's header name is lost too. It should take a header row as the name (or at least warn that it was dropped).
- evidence: read (Row has `kind: 'header'`; `c4/kinds.ts` smallLines already counts header rows as text lines)
- severity: medium
- fix: packages/diagram-formats/src/mermaid/class/write.ts, packages/diagram-formats/src/mermaid/er/write.ts
- size: function
- cause: row-kind switch misses `header`
- confidence: likely

## Flowchart node metadata keys other than `shape` and `label` are dropped without a warning
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:95 (MermaidReader.mention)
- scenario: `A@{ shape: rect, icon: "fa:user", w: 80, img: "x.png" }` reads only `shape` and `label`. `icon`, `img`, `w`, `h`, `pos`, `constraint` and so on vanish, and the import's warnings never mention them. Every other unsupported input in these readers is reported through `warnings.list(...)`.
- evidence: read
- severity: low
- size: line
- cause: option silently dropped on one path
- confidence: sure

## Lexer reads `A--oB` / `A--xB` as an open line to node `oB`, where Mermaid reads a circle or cross edge to `B`
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:59 (LINK)
- scenario: the tail `[ox](?![\p{L}\p{N}_])` refuses a head that is followed by a letter. `A--oB` therefore lexes as link `--` (no head, and not opening a label, because the next char is not whitespace) followed by the word `oB`. The result is edge A→oB with `markerEnd: null`. Mermaid's lexer (`\-\-+[-xo>]`) takes `--o` greedily, which gives A→B with a circle end. Mermaid's own docs warn about exactly this reading for ids that start with o/x. The import silently produces a different graph (a node `oB` instead of `B`, and the wrong end).
- evidence: read
- severity: low
- size: line
- cause: lookahead diverges from Mermaid's link token
- confidence: likely

## Block writer moves a group that holds no blocks to the end of its row, shifting the grid on round-trip
- where: packages/diagram-formats/src/mermaid/block/write.ts:58 (BlockWriter.first / level)
- scenario: `block-beta\n columns 3\n a\n block:g\n end\n b` reads into nodes a, b and an empty container g. On write, `first({cluster: g})` is `Infinity` (no nodes), so `level` sorts g after b and emits `a`, `b`, `block:g end`. g moves from grid cell 2 to cell 3, and b from 3 to 2. The reader kept g's position in its parent's `members` order, which the writer ignores. Top level has no members list at all, so the order is guessed from node order.
- evidence: read
- severity: low
- size: function
- cause: item order derived from first node index; empty clusters have none
- confidence: sure

## Architecture writer silently falls back to R/L for non-compass `routedPorts`
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:84 (ArchWriter.edge)
- scenario: an edge with no `fromPort`/`toPort` but `routedPorts: { from: 'ne', to: 'sw' }`: the warning check only looks at `e.fromPort`/`e.toPort`, but `end()` is passed `e.routedPorts?.from`. `PORT_SIDES.get('ne')` misses, so the edge is written `:R`/`L:` with no warning that the routed sides were changed.
- evidence: read
- severity: low
- size: line
- cause: warning checks a different port source than the write
- confidence: sure

## gitGraph writer spells a main branch name with `"` two different ways, so the file fails to read back
- where: packages/diagram-formats/src/mermaid/gitgraph/write.ts:56 (frontLines)
- scenario: `mainBranch: 'a"b'`: the front matter writes `mainBranchName: "a\"b"` (JSON, which keeps the quote). Every command naming that branch goes through `branchName` → `quoted`, which turns `"` into `'`, giving `checkout "a'b"` / `merge "a'b"`. On read the main branch is `a"b`, and `checkout a'b` names a branch never made, so `replayGitGraph` errors and `readMermaidGitGraph` throws.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/gitgraph/write.ts
- size: line
- cause: one name encoded two ways in one file
- confidence: likely

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

<!-- done: 6 findings, files read: 35 -->
