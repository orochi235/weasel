## C4 reader lists an element declared twice as a member twice, or of two boundaries
- where: packages/diagram-formats/src/mermaid/c4/read.ts:64 (C4Reader.walk)
- scenario: `System(a, "A")` at the top level and again inside `System_Boundary(b, "B") { System(a, "A2") }` → `nodes.set` overwrites the one node, but `members.push(alias)` runs both times, so `a` is a direct member of the page and of container `b` (or appears twice in one container's `members`); a boundary alias reused the same way gives two containers with one id, and `boundary`'s `findIndex` then writes `members` onto the first. Architecture throws "already names" and flowchart/class go through `Membership`, which keeps the first cluster and warns; C4 does neither.
- evidence: read
- severity: medium

## C4 reader throws on an UpdateElementStyle naming no element, which Mermaid ignores
- where: packages/diagram-formats/src/mermaid/c4/read.ts:135 (C4Reader.elementStyle)
- scenario: `UpdateElementStyle(typo, $bgColor="red")`, or one placed before the element it styles → readC4 throws `no element or boundary is named "typo"`, so the whole file fails to import. Mermaid's `updateElStyle` returns without doing anything when it finds no shape or boundary, and renders the diagram. UpdateRelStyle naming no relationship is silently ignored here (relStyle), so the two style macros also disagree with each other. relStyle also restyles every matching from/to pair, where Mermaid restyles the first only.
- evidence: read (Mermaid behavior from memory of c4Db.js)
- severity: medium

## Flowchart `linkStyle … interpolate <curve> <styles>` loses its styles
- where: packages/diagram-formats/src/mermaid/flowchart/parse.ts:79 (statementOf, linkStyle)
- scenario: `linkStyle 0 interpolate basis stroke:#f00,stroke-width:4px`, valid Mermaid → `remainder` is `interpolate basis stroke:#f00,stroke-width:4px`, `propsOf` makes the first pair `['interpolate basis stroke', '#f00']`, so the stroke color is dropped and the warning names a property "interpolate basis stroke". `linkStyle default interpolate basis` alone warns of a property "interpolate basis". The `interpolate <name>` words should be stripped (and warned of) before the props are read.
- evidence: read
- severity: low

## Mermaid detect accepts any-case flowchart headers that the reader then rejects
- where: packages/diagram-formats/src/mermaid/format.ts:91 (FLOWCHART_HEADER), packages/diagram-formats/src/mermaid/flowchart/parse.ts:96
- scenario: a file starting `Flowchart TD` or `GRAPH LR` → `DIAGRAM_MERMAID.detect` says it is Mermaid (`/i` flag), but `parseFlowchart` compares the header word case-sensitively and throws "expected a flowchart header". The question of which header words are a flowchart is answered two ways; detect should match what the reader reads.
- evidence: read
- severity: low

## Journey writer drops a step named exactly "title" or "section", which reads back fine
- where: packages/diagram-formats/src/mermaid/journey/write.ts:22 (stepName)
- scenario: a step named `title` would be written `    title: 3: Me`; the reader's `^(title|section)(?:\s+(.*))?$` does not match `title:` (a colon, not whitespace, follows), so it reads as a step, as Mermaid's lexer (`"title"\s…`) does too. The writer's `(?:\s|$)` test matches the bare word, so the step is dropped with a warning. Only names where whitespace follows the word need dropping.
- evidence: read
- severity: low

## Several graph writers drop end labels and edge colors without a warning
- where: packages/diagram-formats/src/mermaid/er/write.ts:59 (writeErDiagram edge loop); packages/diagram-formats/src/mermaid/architecture/write.ts:82 (ArchWriter.edge); packages/diagram-formats/src/mermaid/c4/write.ts:68 (C4Writer.rel); packages/diagram-formats/src/mermaid/class/write.ts:125 (ClassWriter.relation)
- scenario: an edge with `endLabels` written as ER, architecture or C4 → the labels vanish without a warning, where flowchart and block writers warn "no labels at a connector's ends". An ER or class edge with `colors.stroke`, `colors.label` or a `width` → nothing is written and nothing warned, where block warns "links have no styles" and architecture warns "colors were dropped". Each writer answers "what does this kind say about a dropped edge option" differently.
- evidence: read
- severity: low

## Class writer writes a method with no parentheses as an attribute, without a warning
- where: packages/diagram-formats/src/mermaid/class/write.ts:94 (ClassWriter.node)
- scenario: a class box whose rows below the second divider include `run` (no `(`) → it is written into the body as `run`, and `memberOf` reads it back as an attribute, moving it above the second divider. The writer warns about the reverse case (an attribute holding `(`), but not this one.
- evidence: read
- severity: low

## Block reader treats a pending `space` two ways depending on the statement
- where: packages/diagram-formats/src/mermaid/block/read.ts:93 (BlockReader.walk)
- scenario: `space` then a line `a` re-mentioning an existing block `a` → the items branch sets `skip = 0` whatever `fresh` is, so the space is lost with no warning. The same `space` followed by a links line `a --> c` (with `a` existing, `c` new) carries the skip on to `c`. One of the two is wrong; either way, a dropped space should warn as the trailing case does.
- evidence: read
- severity: low

## C4 writer turns a deployment node whose type is "system", "container" or "enterprise" into a boundary macro
- where: packages/diagram-formats/src/mermaid/c4/write.ts:58 (C4Writer.boundary)
- scenario: read `C4Deployment` with `Deployment_Node(d, "Web", "container") { … }` → label `Web [container]`; written back, `BY_TYPE.get('container')` gives `Container_Boundary`, so the deployment node becomes a container boundary in a deployment diagram. The same happens to `Boundary(b, "x", "system")`. The macro the type picks should apply only where the reader's fixed type came from that macro.
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

<!-- done: 9 findings, files read: 35 -->
