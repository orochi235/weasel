# Audit round 74 — diagram-formats.mermaid.part1 (blind reviewer)

## Architecture reader accepts a group inside itself, or groups nested in a cycle
- where: packages/diagram-formats/src/mermaid/architecture/read.ts:64 (ArchReader.read / place), :97 (readArchitecture)
- scenario: `architecture-beta` / `group a in a`, or `group a in b` / `group b in a`. `place` records `parent a → a`; the check at :97 only asks that the named group exists, so it passes. The container `a` then lists `a` among its own members (or `a` and `b` each list the other). The flowchart and class readers go through `Membership`, which never makes a cluster its own ancestor; this reader skips it. It should throw on the line, the way it does for a name given twice, or else keep the first place.
- evidence: read
- severity: medium

## Block reader: a group id given twice, or shared with a block, gives two items with one id
- where: packages/diagram-formats/src/mermaid/block/read.ts:103-110 (BlockReader.walk, group branch)
- scenario: `block:G` … `end` and then `block:G` … `end` again. `this.groups.set(id, inner)` replaces the first group's member list, so its blocks end up in no container and fall to the top level, and `members.push(id)` puts `G` in its parent twice. Similarly, `G` used as a plain block (`G` on an items line) and as `block:G` gives a node `G` and a container `G`. Items-line blocks are not checked against `groupIds`; only link ends are. Either should throw, naming the line, or merge into the first.
- evidence: read
- severity: medium

## Block writer writes grid counts its own reader cannot read
- where: packages/diagram-formats/src/mermaid/block/write.ts:47-50 (span), :58 (skip), :76 (clusterColumns), :121 (columns)
- scenario: grid options from a page holding a non-integer value, e.g. `spans: { A: 2.5 }`, `skips: { A: 1.5 }` or `columns: 2.5`. The writer emits `A:2.5`, `space:1.5` or `columns 2.5`. The parser's `SPAN` (`:(\d+)`) reads `:2`, and then `.5` cannot be read as a block, so it throws. `columns 2.5` misses the `columns` pattern and is read as two blocks named `columns` and `2.5`. Values should be rounded or dropped with a warning, the way the gitgraph writer handles branch order.
- evidence: read
- severity: low

## Block reader applies `classDef default` to groups; the flowchart reader does not apply it to subgraphs
- where: packages/diagram-formats/src/mermaid/block/read.ts:149 (containers via StyleSheet.colorsOf); common/styles.ts:142 (colorsOf); compare flowchart/read.ts:224 (propsOf(id, false))
- scenario: `classDef default fill:#f00` in a block diagram turns every `block … end` container red, because `StyleSheet.colorsOf` always starts from `default`. The flowchart reader leaves `default` off containers on purpose (`isNode ? … : undefined`). The same question gets two answers in two places.
- evidence: read
- severity: low

## C4 writer silently drops a node's stroke width and dash
- where: packages/diagram-formats/src/mermaid/c4/write.ts:51-58 (C4Writer.colors)
- scenario: an element or boundary with `colors: { strokeWidth: 3, dash: [4,4] }` is written with only fill, text and stroke in `UpdateElementStyle`. The width and dash disappear, and unlike every other dropped property in these writers, no warning says so.
- evidence: read
- severity: low

## C4 writer writes colors raw where every other Mermaid writer normalizes them with hexColor
- where: packages/diagram-formats/src/mermaid/c4/write.ts:53-55, :98-99 (colors, relColors); compare common/styles.ts:113-120 (styleProps uses hexColor)
- scenario: a node fill held in a form other than hex (whatever `hexColor` exists to convert) goes into `$bgColor="…"` as written. Every other kind passes it through `hexColor` first. When read back, `mermaidColor` may reject it with a warning, or two writers spell the same color differently.
- evidence: read (did not confirm which color forms a document can hold)
- severity: low

## C4 deployment writer turns every boundary into a Deployment_Node without warning
- where: packages/diagram-formats/src/mermaid/c4/write.ts:62-66 (boundary)
- scenario: a C4Deployment page read from `System_Boundary(s, "Sys")` has the label `Sys [system]`. On write, `this.deployment` forces `Deployment_Node(s, "Sys", "system")`, so the system boundary comes back as a deployment node of type "system". There is no warning.
- evidence: read
- severity: low

## ER writer silently writes `crow-many` as one-or-many
- where: packages/diagram-formats/src/mermaid/er/write.ts:16 (ENDS)
- scenario: an edge ending in `crow-many` is written `}|` / `|{` and reads back as `crow-one-many`, so the marker changes. `end()` warns only when the marker is unknown, so this change is silent.
- evidence: read
- severity: low

## Class writer silently drops namespace and note colors, and notes' namespace membership
- where: packages/diagram-formats/src/mermaid/class/write.ts:139-144 (styles), :117-122 (noteLines), :87-88 (node skips notes)
- scenario: a container with `colors`, or a `note` node with `colors`, is written with no `style` line, and no warning says so; `styles()` covers only non-note nodes. A note inside a container is skipped by `node()` and written at the top level by `noteLines`, so it leaves the namespace without a warning.
- evidence: read
- severity: low

## Flowchart lexer refuses link text that runs right up to its closing arrow
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:290-293 (linkText)
- scenario: `flowchart LR` / `A -- yes-->B` throws "a link's text after "--" is never closed", because a closer counts only where whitespace comes before it (`/\s/.test(text[k])`). Mermaid's own grammar ends edge text at the `-->` token with no space needed, so files Mermaid renders are refused here.
- evidence: read (Mermaid's behavior from memory of its jison grammar, not run)
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

<!-- done: 10 findings, files read: 35 -->
