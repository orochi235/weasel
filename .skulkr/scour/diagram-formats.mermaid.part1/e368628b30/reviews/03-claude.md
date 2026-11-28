## Gantt writer leaves `;` unspelled in names, titles and sections, and `#`/`;` raw in task ids, which Mermaid's gantt lexer stops a token at
- where: packages/diagram-formats/src/mermaid/common/text.ts:47 (spelledLine); packages/diagram-formats/src/mermaid/gantt/write.ts:56 (taskIds)
- scenario: a gantt task named `Build; test`, or a section or title holding `;`, is written as-is (spelledLine spells only `#` and `:`). A task id `a#1` or `a;b` passes `plain` (it checks only whitespace, commas and tag words) and is written raw after the colon. Mermaid's gantt grammar reads task data as `":"[^#\n;]+` and titles and sections up to `#`/`;`, so real Mermaid truncates or rejects these lines. The package's own reader doesn't treat `;` as syntax, so a round-trip test passes while the file breaks in Mermaid. The journey writer handles the same characters (it strips `#` and `;`), so the two kinds disagree.
- evidence: read (Mermaid grammar recalled, not checked against its source in this tree)
- severity: low
- fix: packages/diagram-formats/src/mermaid/common/text.ts, packages/diagram-formats/src/mermaid/gantt/write.ts
- size: function
- cause: spelled set missing `;`; id check missing `#` and `;`
- confidence: likely

## Flowchart lexer splits `A--text-->B` (link text with no space after `--`) into three nodes instead of a labeled link
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:268 (MermaidLexer.link)
- scenario: `opens` is true only when the `--`/`==`/`-.` is followed by whitespace. For `A--text-->B`, the lexer emits `--` as a link with no end, then the word `text`, then `-->`. The parser builds the chain A --- text --> B: a phantom node `text` and two edges. Mermaid's START_LINK rule (`\s*[xo<]?\-\-\s*`) allows no whitespace there, so Mermaid reads one edge A→B labeled "text".
- evidence: read (Mermaid grammar recalled)
- severity: low
- size: function
- cause: link text opens only when whitespace follows
- confidence: likely

## Architecture writer silently maps a non-compass routed port to R/L without warning
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:79 (ArchWriter.edge)
- scenario: an edge with no `fromPort` but a `routedPorts.from` such as `'ne'` or a named port. `end()` uses `e.fromPort ?? e.routedPorts?.from`, so `PORT_SIDES.get` misses and the side falls back to `R`. The warning checks only `e.fromPort` and `e.toPort`, so the change of side is never reported, while the same port given as `fromPort` would be.
- evidence: read
- severity: low
- size: line
- cause: warning tests a different value than the one written
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
