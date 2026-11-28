# Findings: diagram-formats.mermaid.part1

## Flowchart writer silently writes a path outline as a rectangle
- where: packages/diagram-formats/src/mermaid/flowchart/write.ts:69 (MermaidWriter.node)
- scenario: a node whose `outline` is a `Path` (the `Outline` type is `BuiltinOutline | string | Path`) is written. `brackets` is undefined, but the warning only fires when `typeof outline === 'string'`, so the node comes out as `id["…"]` (a rectangle) with no warning. It should warn as it does for an unknown string outline. The block writer (`block/write.ts` `block()`) warns whenever `brackets === undefined`, so the two writers handle the same case differently.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/mermaid/flowchart/write.ts
- size: line
- cause: warning gated on a string outline
- confidence: sure

## Architecture and C4 writers drop the page direction without a warning
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:100 (writeArchitecture); packages/diagram-formats/src/mermaid/c4/write.ts:107 (writeC4)
- scenario: a graph page with `direction: 'down'` (or `'up'`/`'left'`) and notation `architecture` is written. Mermaid architecture has no direction statement, and `readArchitecture` always reads `direction: 'right'`, so the round trip turns the page sideways and `warnings` says nothing about it. `writeC4` likewise never reads `page.direction`. Every other dropped property in these writers (positions, styles, labels, ports) gets a warning.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/architecture/write.ts, packages/diagram-formats/src/mermaid/c4/write.ts
- size: line
- cause: missing drop warning
- confidence: likely

## Block diagram line with two links in a row followed by two blocks reads as a chain
- where: packages/diagram-formats/src/mermaid/block/parse.ts:113 (LineReader.read)
- scenario: `a --> --> b c` (or `a b --> --> c`) collects items `[a, b, c]` and two links. The check only compares counts (`ends.length === links.length + 1` and `ends.length === items.length`), not that blocks and links alternate, so it passes and reads as `a → b → c` instead of throwing "cannot read … as blocks joined by links". The order in which items and links appeared is never recorded.
- evidence: read
- severity: low
- size: function
- cause: count check instead of alternation check
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
