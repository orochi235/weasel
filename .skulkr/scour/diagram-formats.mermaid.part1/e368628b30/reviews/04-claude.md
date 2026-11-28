# Findings: diagram-formats.mermaid.part1

## Flowchart reader drops every plain mention of a node whose id is also some link's id
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:84 (MermaidReader.mention)
- scenario: `flowchart TD\n  A e1@--> B\n  e1 --> C`. `edgeIdsOf` collects `e1`, and `mention` returns early for any ref `e1` that has no shape. It does that whether or not the ref carries `@{…}` metadata. So node `e1` is never created, and a spurious "edge metadata was dropped" warning is raised. `link()` still pushes an edge `e1 → C` to a node that does not exist. The early return should apply only to a ref that carries metadata (`ref.meta !== undefined`) and is not otherwise a node.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/mermaid/flowchart/read.ts
- size: line
- cause: edge-id test ignores whether the ref has metadata
- confidence: likely

## Flowchart lexer cannot read a circle- or cross-ended link that has text between its dashes
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:265 (MermaidLexer.link)
- scenario: `A o-- text --o B` (or `x-- text --x`). The LINK match gives lead `o`, body `--` and no tail. The guard `(lead === 'o' || lead === 'x') && tail !== lead` returns false before the text-link path (`opens`/`linkText`) is tried. `o` is then lexed as a word, and the parser throws "expected the end of the statement, found "o"". The same link with `|text|` reads, so a valid Mermaid link form is refused. For an opening link, the guard should compare the lead with the closer's head that `linkText` returns.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/flowchart/lex.ts
- size: function
- cause: lead/tail check runs before the text-link closer is known
- confidence: likely

## C4 relationship technology with an empty label round-trips into the label
- where: packages/diagram-formats/src/mermaid/c4/write.ts:96 (C4Writer.rel), packages/diagram-formats/src/mermaid/c4/read.ts:114 (C4Reader.rel)
- scenario: `Rel(a, b, "", "HTTPS")`. The reader builds the label from `[text(label), "[tech]"]` and gets `[HTTPS]`. On write, `/^(.*?)(?: \[([^\]]*)\])?$/` needs a space before `[`, so `m[1]` is `[HTTPS]` and `m[2]` is undefined. The output is `Rel(a, b, "[HTTPS]")`, which moves the technology into the description/label argument. The element path (`elementParts`) keeps the two apart, but the relationship path does not. The writer regex should also take a label that is only `[tech]`.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/c4/write.ts
- size: line
- cause: label/technology split regex requires a leading space
- confidence: sure

## gitGraph directive setting only the main branch is still warned as dropped when the name holds an apostrophe
- where: packages/diagram-formats/src/mermaid/gitgraph/read.ts:21 (directiveJson)
- scenario: `%%{init: {"gitGraph": {"mainBranchName": "O'Brien"}}}%%`. `BRANCH_NAME` reads the name correctly. `directiveJson` then replaces every `'` with `"`, the JSON fails to parse, and `onlyMainBranch(null)` is false. `directives` is not decremented, so `readPageName` warns that the configuration directives were dropped, although the only thing they set was read.
- evidence: read
- severity: low
- fix: packages/diagram-formats/src/mermaid/gitgraph/read.ts
- size: function
- cause: blanket quote replacement corrupts values that contain apostrophes
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

<!-- done: 4 findings, files read: 35 -->
