# Findings: diagram-formats.mermaid.part1

## Flowchart, block and architecture writers rename ids their own readers accept (`node-1`, `1`, `a.b`)
- where: packages/diagram-formats/src/mermaid/flowchart/write.ts:35 (MermaidWriter constructor), packages/diagram-formats/src/mermaid/block/write.ts:40 (BlockWriter constructor), packages/diagram-formats/src/mermaid/architecture/write.ts:28 (ArchWriter constructor)
- scenario: The flowchart lexer's and block parser's `WORD` (`[\p{L}\p{N}_](?:[\p{L}\p{N}_]|[-.](?=…))*`) and architecture's `ID` (`[\p{L}\p{N}_][\p{L}\p{N}_-]*`) read `node-1`, `1` and `a.b` as ids. All three writers call `mermaidIds(…, { unicode: true })`, which only keeps ids matching `^[\p{L}_][\p{L}\p{N}_]*$`. So reading `flowchart TD\n 1 --> node-1` and writing it back gives `n1 --> node_1`: every id with a hyphen, a dot or a leading digit is renamed on a plain round trip. In the block writer, the reader's own minted anonymous group id `block-1` can never be written as itself either: once a span or an edge forces it to be named, it comes back as `block_1`. The writers should pass an `id` regex matching what their reader takes, as the class and ER writers already do.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/mermaid/flowchart/write.ts, packages/diagram-formats/src/mermaid/block/write.ts, packages/diagram-formats/src/mermaid/architecture/write.ts
- size: line
- cause: writer's id grammar narrower than reader's
- confidence: sure

## mermaidIds treats a flowchart's keywords as case-insensitive, so `End`, `Graph` and `Style` nodes are renamed
- where: packages/diagram-formats/src/mermaid/common/text.ts:76 (mermaidIds)
- scenario: `words` lowercases every keyword, and `valid` tests `words.has(id.toLowerCase())`. A node whose id is `End` or `END` (Mermaid's own documented fix for the `end` trap) or `Style` is judged reserved and written as `End_`. The flowchart reader's keyword checks are case-sensitive (`word(t, 'end')` in parse.ts, and `REST_KEYWORDS.has(word[0])` in lex.ts), so `End` would read back unchanged. Result: a flowchart with `Start --> End` comes back as `Start --> End_`, with the node's id changed.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/common/text.ts
- size: line
- cause: case-folded keyword set vs case-sensitive reader
- confidence: sure

## C4 writer moves a relationship's technology into its label when the relationship has no label text
- where: packages/diagram-formats/src/mermaid/c4/write.ts:99 (C4Writer.rel)
- scenario: Reading `Rel(a, b, "", "HTTPS")` gives the edge label `[HTTPS]` (in read.ts, `words` is `[undefined-filtered, '[HTTPS]']`). The writer splits labels with `/^(.*?)(?: \[([^\]]*)\])?$/s`, which needs a space before `[`, so `[HTTPS]` matches as all label and no technology. The output is `Rel(a, b, "[HTTPS]")`, which reads back with the technology argument gone and the bracketed text as the label. The reader joins with `' '` only when there is a label, so the writer's split has to allow a bare `[tech]`.
- evidence: read
- severity: low
- size: line
- cause: split regex requires leading space
- confidence: sure

## C4 reader accepts BiRel_U, BiRel_Back and RelIndex_Back, which the writer cannot produce, and reads BiRel_Back as one-way
- where: packages/diagram-formats/src/mermaid/c4/read.ts:28 (REL), packages/diagram-formats/src/mermaid/c4/read.ts:112 (C4Reader.rel)
- scenario: `REL` allows any of `Rel|BiRel|RelIndex` with any suffix. `BiRel_U(a, b)` reads with ports n/s, but the writer says "Mermaid C4 has no direction for a two-way or backward relationship" and drops them. So the reader and writer answer differently whether a two-way relationship has a direction. `BiRel_Back(a, b)` takes `back` and sets `markerEnd: null`, so a relationship named bidirectional reads as a one-headed backward arrow.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/c4/read.ts, packages/diagram-formats/src/mermaid/c4/write.ts
- size: function
- cause: reader grammar wider than the macros Mermaid and the writer have
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

<!-- done: 4 findings, files read: 35 -->
