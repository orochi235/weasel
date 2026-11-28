## Class writer silently drops every head row past the first name once the box has dividers
- where: packages/diagram-formats/src/mermaid/class/write.ts:28 (classParts)
- scenario: a node whose rows are label "Foo", label "subtitle", divider, label "x", divider, label "m()" (a class box from another format, or edited, with two rows above the first divider). `names` is ["Foo", "subtitle"]; since `rest.length > 1`, attributes is `rest[0]` and methods `rest.slice(1)`, so `names.slice(1)` ("subtitle") appears nowhere in the output and no warning is given. Without dividers the same rows are kept as members, so the two paths answer the question differently. It should be written as a member or warned of.
- evidence: read
- severity: low
- size: line
- cause: extra name rows only folded into members on the no-divider path
- confidence: sure

## Class and ER writers ignore `header` rows, losing a box's title
- where: packages/diagram-formats/src/mermaid/class/write.ts:21 (classParts)
- scenario: a node whose rows start with `{ kind: 'header', text: 'Customer' }` (sceneReaders.ts produces these; rows of kind `header` are a first-row title) written as a class diagram: the loop keeps only `label`, `field` and `divider` rows, so the header text is dropped without a warning and the class is named by its id (or by its first attribute). `er/write.ts` `entityParts` (line 24) filters to `label`/`field` the same way, so the entity's name becomes its first attribute row. A header should read as the name.
- evidence: read
- severity: medium
- fix: packages/diagram-formats/src/mermaid/class/write.ts, packages/diagram-formats/src/mermaid/er/write.ts
- size: line
- cause: row kinds filtered without `header`
- confidence: likely

## Block parser accepts blocks and links that do not alternate
- where: packages/diagram-formats/src/mermaid/block/parse.ts:118 (LineReader.read)
- scenario: the line `A B --> C -->` reads items [A, B, C] and two links; the check `ends.length === links.length + 1 && ends.length === items.length` passes (3 = 3 = 3), so it is read as A→B and B→C, though A and B are adjacent with no link and the last link has no target. It should throw "cannot read … as blocks joined by links". The check counts rather than checking that blocks and links alternate.
- evidence: read
- severity: low
- size: function
- cause: count check instead of alternation check
- confidence: sure

## Block writer moves an empty group to the end of its level
- where: packages/diagram-formats/src/mermaid/block/write.ts:54 (BlockWriter.first)
- scenario: a grid page whose containers are [g1 (members a), g2 (no members), g3 (members b)]. `first(g2)` is `Infinity` (no nodes, no clusters), so the sort puts g2 after g3, and two empty groups compare as `Infinity - Infinity = NaN`. On read, the grid puts g2 in the last cell instead of between g1 and g3, so cells shift. An empty group should keep its place among its siblings (by container order).
- evidence: read
- severity: low
- size: function
- cause: order taken only from member nodes
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
