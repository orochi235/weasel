# Findings: diagram-formats.mermaid.part1

## Class diagram note writer loses an `&` that comes before a backslash
- where: packages/diagram-formats/src/mermaid/class/write.ts:146 (ClassWriter.noteLines)
- scenario: a note whose text is `a&\b`. `spelled(l)` runs `spelledBreaks`, which spells an `&` only when an entity follows it. At that point the next character is still `\`, so the `&` is left alone. Only after that does `.replace(/\\/g, '#92;')` turn the backslash into `#92;`, which writes `note "a&#92;b"`. On read, `decodeEntities(…, true)` takes `&#92;` as an HTML numeric entity and gives `a\b`, so the `&` is gone. It should read back as `a&\b`. The fix is to spell the backslash before `spelledBreaks` checks the `&`.
- evidence: read (decodeEntities regex `&(#x…|#\d+|[a-z]+);` in graphRead.ts:38)
- severity: low
- size: line
- cause: `&` checked before the entity it comes to open is written
- confidence: sure

## Block writer leaves out the id of any container named like `block-N`, so it reads back under a different id
- where: packages/diagram-formats/src/mermaid/block/write.ts:105 (BlockWriter.group)
- scenario: the writer leaves the id off any container matching `/^block-\d+$/` that has no span, edge or style. The reader then gives each unnamed `block … end` the next free `block-N`, counting in the order the groups appear in the file (`IdMint.next('block')`). That is not always the original id:
  - a page whose only container is `block-2` (for example after `block-1` was deleted) is written as bare `block` and reads back as `block-1`;
  - two containers `block-1` and `block-2`, where `block-2`'s first node comes earlier on the page, are written in swapped order and read back with their ids swapped.

  No warning is given either way. The kanban writer already handles the same situation by replaying the reader's mint and writing the id wherever the mint would not give it back (`kanban/write.ts:71`). The block writer should do the same.
- evidence: read
- severity: low
- size: function
- cause: assumes every `block-N` id would be minted again as itself
- confidence: likely

## Flowchart lexer reads `A--text-->B` as two links through an extra node `text`
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:276 (MermaidLexer.link, `opens`)
- scenario: link text only opens when whitespace follows `--`, `==` or `-.`. With `A--text-->B`, the `--` is followed by `t`, so the lexer emits an open link `--`, then the word `text`, then `-->`. The chart reads as A --- text --> B, with a node named "text" and two edges. Mermaid's own lexer starts link text at `--` with optional whitespace (`\-\-\s*`), so it reads this as one labeled edge from A to B. The same happens with `A==text==>B`.
- evidence: read (the claim about Mermaid's grammar is from memory of its jison lexer, not checked against its source here)
- severity: medium
- size: line
- cause: whitespace required after the link text opener
- confidence: likely

## Flowchart reader drops a plain node mention whose id is also an edge's id, leaving its edges pointing at nothing
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:94 (MermaidReader.mention)
- scenario: `A e1@--> B` followed by `e1 --> C`. `mention` returns early for any reference whose id is in `edgeIds` and has no shape. That is meant for `e1@{ … }` edge metadata, but it also catches the bare mention `e1` and a mention with a class only (`e1:::c`). No node `e1` is created and the "edge metadata was dropped" warning is wrong. `walk` still builds the edge `e1 → C`, so that edge points at a node that does not exist. The early return should require `ref.meta !== undefined`.
- evidence: read
- severity: low
- size: line
- cause: edge-metadata test doesn't check for metadata
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
