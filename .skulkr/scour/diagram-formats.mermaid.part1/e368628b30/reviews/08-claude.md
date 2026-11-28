## ER writer drops a node's `header` row and turns its first attribute into the entity's name
- where: packages/diagram-formats/src/mermaid/er/write.ts:23 (entityParts)
- scenario: a table-shaped node `rows: [{kind:'header', text:'Table'}, {kind:'field', label:'id', value:'int'}]` (the shape the diagram stencils build) is written as `id["id int"]` with no attributes. `rows.filter(label|field)` skips the header, so the first field becomes the name and the real title "Table" is lost with no warning. It should use the header text as the name and keep every field as an attribute.
- evidence: read
- severity: medium
- size: line
- cause: header row kind not considered
- confidence: sure

## Class writer silently drops a node's `header` row
- where: packages/diagram-formats/src/mermaid/class/write.ts:17 (classParts)
- scenario: a node whose rows open with `{kind:'header', text:'Customer'}` followed by dividers and labels. The loop handles only divider, label and field rows, so the header text is ignored, and the class is written under `node.id` with no label. There is no warning (`nodeLines`, which warns about the rows it drops, is never called here). The header should be the class name.
- evidence: read
- severity: medium
- size: line
- cause: header row kind not considered
- confidence: sure

## Class writer keeps extra name lines as members in one case and drops them silently in the other
- where: packages/diagram-formats/src/mermaid/class/write.ts:30 (classParts)
- scenario: rows `[label A, label B, divider, label x, divider, label m()]` give `names = [A, B]`. With two dividers (`rest.length > 1`), attributes are `rest[0]` and `B` vanishes without a warning. With zero or one divider, `names.slice(1)` is kept as members. The same second line is kept on one path and dropped on the other.
- evidence: read
- severity: low
- size: line
- cause: names.slice(1) left out of the divided branch
- confidence: sure

## A class name or label written as `<<…>>` reads back as an annotation, and the name is lost
- where: packages/diagram-formats/src/mermaid/class/write.ts:28 (classParts)
- scenario: the reader yields name row `<<x>>` for `class A["<<x>>"]`, or a user names a box `<<Service>>` with no annotations. classParts treats every `<<…>>` line above the first divider as an annotation, so the class is written as `class A { <<x>> }`. The label is gone and an annotation has been added. The writer never spells the brackets to stop this.
- evidence: read
- severity: low
- size: function
- cause: annotation detected by text shape alone
- confidence: sure

## Block writer turns any dash pattern into Mermaid's dotted link without a warning
- where: packages/diagram-formats/src/mermaid/block/write.ts:110 (BlockWriter.link)
- scenario: an edge with `colors.dash: [10, 2]` is written as `-.-`, which reads back as `[4, 4]`. The function warns about stroke, label and width but never about dash, whereas the flowchart writer keeps a non-dotted dash through `linkStyle` and other kinds call `dropEdgeColors`. The pattern changes silently.
- evidence: read
- severity: low
- size: line
- cause: dash missing from dropped-style warnings
- confidence: sure

## Block writer moves an empty `block … end` group to the end of its level, which shifts the grid
- where: packages/diagram-formats/src/mermaid/block/write.ts:57 (BlockWriter.first / level)
- scenario: `columns 3` with `a`, then `block:g end` (empty), then `b c`. The reader places g in the second cell. On write, `first()` returns `Infinity` for a cluster with no nodes, so g sorts after b and c, and the round trip puts b where g was. The parent's member order is not used.
- evidence: read
- severity: low
- size: function
- cause: order derived from first node's page index
- confidence: likely

## Architecture and block writers rename ids their own readers accept
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:27 (ArchWriter constructor), packages/diagram-formats/src/mermaid/block/write.ts:39 (BlockWriter constructor)
- fix: packages/diagram-formats/src/mermaid/architecture/write.ts, packages/diagram-formats/src/mermaid/block/write.ts
- scenario: the architecture reader's ID accepts `-` (`[\p{L}\p{N}_][\p{L}\p{N}_-]*`), and the block reader's WORD accepts `-`, `.` and a leading digit. Both writers use `mermaidIds({unicode:true})`, whose id pattern takes none of these. So `service my-db` round-trips as `service my_db[my-db]`, and block `1` comes back as `n1`. Ids change on every round trip even though they could be written unchanged, contrary to mermaidIds' "itself where it can be".
- evidence: read
- severity: low
- size: line
- cause: no `id` pattern passed for the kind's own grammar
- confidence: sure

## gitGraph reader warns that a directive setting only the main branch name was dropped when the name holds an apostrophe
- where: packages/diagram-formats/src/mermaid/gitgraph/read.ts:20 (directiveJson)
- scenario: `%%{init: {"gitGraph": {"mainBranchName": "bob's"}}}%%`. The name is read correctly, but `replace(/'/g, '"')` makes the JSON `"bob"s"`, so the parse fails and `onlyMainBranch` returns false. The directive count is not lowered, and readPageName warns "Mermaid configuration directives were dropped." about a directive that was fully read.
- evidence: read
- severity: low
- size: line
- cause: blanket quote replacement corrupts double-quoted values
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

<!-- done: 8 findings, files read: 35 -->
