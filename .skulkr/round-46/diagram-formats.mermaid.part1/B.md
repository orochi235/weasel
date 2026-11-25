I couldn't write `.skulk/out/findings.md` because permission was denied twice, so the whole findings document is below.

# Findings: diagram-formats.mermaid.part1

## An anonymous block group's style and links are written under a renamed id the reader never gives it
- where: packages/diagram-formats/src/mermaid/block/write.ts:71 (BlockWriter.group), :103 (styles), :87 (link)
- scenario: take a container `block-1` that has `colors` or an edge. That is the id readBlockDiagram mints for an anonymous `block … end`, through IdMint/freshId and its `-` separator.
  - `group` tests the raw id against `/^block-\d+$/` and writes a bare `block`.
  - But `styles()` and `link()` write `this.id(c.id)`, and mermaidIds turns that into `block_1`, because `-` is not a valid id character.
  - Reading the file back mints the group as `block-1` again. So `style block_1 …` styles nothing and the colors are lost with no warning.
  - A link `x --> block_1` creates a new stray rect block `block_1` instead of meeting the group.
  - The writer should name the group (`block:<id>`) whenever a style or a link refers to it.
- evidence: read
- severity: medium

## Empty front matter is skipped by the kind sniffer but not by the readers
- where: packages/diagram-formats/src/mermaid/common/header.ts:28 (frontMatter) vs :43 (headerWord); also flowchart/lex.ts:86 (MermaidLexer.frontMatter)
- scenario: the input `---\n---\nerDiagram\n  A ||--o{ B : has`.
  - headerWord skips the `---`/`---` pair and reports `erDiagram`, so the ER reader is chosen.
  - frontMatter's regex needs a `\n` between the two fences (`---[ \t]*\n([\s\S]*?)\n---`), so an empty block doesn't match.
  - statementsOf then takes `---` as the header and throws "expected an erDiagram header, found ---".
  - For a flowchart, the lexer reads `---` as a link and fails with "expected a flowchart header".
  - Both front-matter readers should accept the empty block.
- evidence: read
- severity: low

## The flowchart drops `accTitle`, while every other kind names the page by it
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:156 (MermaidReader.walk, `other` branch); flowchart/parse.ts:56 (KEYWORDS)
- scenario: the input `flowchart TD\n  accTitle: Login flow\n  A --> B`, with no front-matter title.
  - accTitle lexes as a keyword statement and parses to `{ kind: 'other' }`.
  - The reader drops it with the warning "statements a diagram does not hold were dropped: accTitle", and the page gets no name.
  - The same accTitle in a class, ER, block, architecture, C4, gantt, gitGraph or journey diagram goes through readPageName. That names the page by it and warns only when there is also a title.
  - The flowchart answers this question differently from every other kind.
- evidence: read
- severity: low

## C4 silently drops a front-matter title when there is also a `title` statement
- where: packages/diagram-formats/src/mermaid/c4/read.ts:152 (readC4)
- scenario: the input `---\ntitle: A\n---\nC4Context\n  title B`.
  - `name = r.title ?? named` keeps B and drops A with no warning.
  - gantt (gantt/read.ts:45) and journey (journey/read.ts:41) meet the same conflict and warn "The front matter title was dropped".
  - The C4 reader should give the same warning.
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

<!-- done: 4 findings, files read: 35 -->