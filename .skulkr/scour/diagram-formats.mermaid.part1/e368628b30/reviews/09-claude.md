# Findings: diagram-formats.mermaid.part1

## Class diagram note text loses an `&` that comes right before a backslash
- where: packages/diagram-formats/src/mermaid/class/write.ts:139 (ClassWriter.noteLines)
- scenario: a `note` shape whose text is `R&\D`. `spelled()` runs `spelledBreaks` first, and it leaves the `&` alone because nothing after it looks like an entity yet. Only after that does `.replace(/\\/g, '#92;')` turn the backslash into `#92;`, so the line written is `note "R&#92;D"`. On read, `decodeEntities(l, true)` matches `&#92;` as one HTML numeric reference, and the note comes back as `R\D`. The `&` is silently lost. It should come back as `R&\D`: the `&` needs to be spelled `#38;` once the `#92;` exists, which means escaping `\` before `spelledBreaks` runs.
- evidence: read (traced against the `decodeEntities` regex in graphRead.ts:38)
- severity: low
- fix: packages/diagram-formats/src/mermaid/class/write.ts
- size: line
- cause: an entity is added after the `&` guard has already run
- confidence: sure

## Class, ER and block writers drop a connector's dash pattern without a warning
- where: packages/diagram-formats/src/mermaid/class/write.ts:153 (writeClassDiagram, `dropEdgeColors(..., ['dash'])`); packages/diagram-formats/src/mermaid/er/write.ts:73; packages/diagram-formats/src/mermaid/block/write.ts:110 (BlockWriter.link)
- scenario: an edge with `colors.dash = [2, 6]`. All three writers write any dash as a dotted line (`..`, `..`, `-.-`), and each reader reads that back as `[4, 4]`. The class and ER writers list `dash` as kept in `dropEdgeColors`, so nothing warns. The block writer warns about stroke, label and width, but not dash. The pattern changes with no warning. The flowchart writer handles the same case properly, writing the custom pattern as a `linkStyle … stroke-dasharray`, so the kinds answer one question two ways. Expected: a warning whenever the dash is not `[4, 4]` (or not `DOTTED_DASH`).
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/class/write.ts, packages/diagram-formats/src/mermaid/er/write.ts, packages/diagram-formats/src/mermaid/block/write.ts
- size: function
- cause: "has a dash" is checked, not which dash
- confidence: sure

## Architecture and block writers rename ids their own readers accept
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:26 (ArchWriter constructor); packages/diagram-formats/src/mermaid/block/write.ts:40 (BlockWriter constructor)
- scenario: a service with id `db-1`, or a block with id `a.b` or `2nd`. The architecture parser's `ID` is `[\p{L}\p{N}_][\p{L}\p{N}_-]*`, and the block parser's `WORD` also allows `-` and `.` inside a word and a leading digit. But both writers call `mermaidIds(..., { unicode: true })` with no `id:` override, so the flowchart's UNICODE id rule applies: no `-` or `.`, and no leading digit. That makes `db-1` come back as `db_1`. Flowchart keywords such as `end`, `style` and `default` are also renamed in architecture diagrams, where they are not keywords. Every write → read round trip changes those node and container ids. The class and ER writers already pass an `id:` regex that matches their reader; these two don't.
- evidence: read
- severity: low
- size: line
- cause: the writer's id rule doesn't match the kind's grammar
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

<!-- done: 3 findings, files read: 35 -->
