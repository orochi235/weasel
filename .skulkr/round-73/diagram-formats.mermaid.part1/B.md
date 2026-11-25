## Architecture writer lets a service id be `accTitle`/`accDescr`, so its edges read back as accessibility text
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:27 (ArchWriter constructor, mermaidIds without ACC_WORDS) and :93 (edge)
- scenario: a service with id `accDescr` joined to `b` is written `  accDescr:R -- L:b`; `statementsOf`'s acc regex (`^acc(Title|Descr)\s*:`) takes the line as an accessible description `R -- L:b`, so the edge disappears (and with `accTitle` the page is named "R -- L:b"). The state, sequence and mindmap writers reserve `ACC_WORDS` for exactly this; this one doesn't.
- evidence: read
- severity: medium

## Block writer lets a block id be `accTitle`/`accDescr`; a span or a `{` shape then reads as accessibility text or throws
- where: packages/diagram-formats/src/mermaid/block/write.ts:26 (BlockWriter constructor, reserved: BLOCK_WORDS only), :75 (block), :58 (level)
- scenario: a rect block `accDescr` with grid span 2 is written `  accDescr:2`, read back by `statementsOf` as accDescr "2", so the block is lost. A diamond block `accDescr` is written `accDescr{"x"}`, which reads as an `accDescr {` block. With `accTitle` either form makes the reader throw ("accTitle takes one line after a colon") on text the writer produced.
- evidence: read
- severity: medium

## ER writer lets an entity id be `accTitle`/`accDescr`; an entity with attributes then reads as accessibility text or throws
- where: packages/diagram-formats/src/mermaid/er/write.ts:51 (mermaidIds without ACC_WORDS), :56 (`${head} {`)
- scenario: an unlabeled entity `accDescr` with one attribute is written `  accDescr {` / `    string name` / `  }`; `statementsOf` reads those lines as a multi-line accDescr block, so the entity and its attributes are dropped. With `accTitle` the reader throws on the writer's own output.
- evidence: read
- severity: medium

## A nested class generic whose inner argument starts with a non-ASCII-word character round-trips wrong
- where: packages/diagram-formats/src/mermaid/class/read.ts:25 (angled) against class/write.ts:76 (node, `balanced` accepts it)
- scenario: a class named `Foo<List<?>>` (or `Foo<Map<Ä>>`, `Foo<List<[int]>>`) passes `balanced` and is written `class Foo~List~?~~`. On read, `angled` turns a `~` into `<` only when an ASCII `\w` follows it, so `~?` becomes `>` and the name comes back `Foo<List>?>>` instead of `Foo<List<?>>`. The writer's guard and the reader's rule decide the same thing two ways.
- evidence: read
- severity: low

## An architecture edge's side is silently dropped at a `{group}` end
- where: packages/diagram-formats/src/mermaid/architecture/read.ts:53 (ArchReader.end)
- scenario: `a{group}:B -- T:b` returns `{ id: group }` with no port, so the `B` side is lost without a warning. The writer (write.ts:73) writes the side for a group end, so a container edge's port is lost on round trip and nothing says so. The "no group" branch beside it keeps the port.
- evidence: read
- severity: low

## Block reader drops a `space` before a block mentioned again only on an items line; on a links line it carries to the next block
- where: packages/diagram-formats/src/mermaid/block/read.ts:93 (walk, items branch) vs :100 (links branch)
- scenario: `a` … `space` / `a b` (items line): the space before `a`, which is not fresh, is cleared at `skip = 0` and never reaches `b` or a warning. The same `space` before a links line `a --> b` is kept and applied to the next fresh block (`b`). The two branches treat a space before a re-mentioned block differently, and the items branch drops it with no warning.
- evidence: read
- severity: low

## Class writer writes an attribute or method row `<<x>>` into the body, where it reads back as an annotation
- where: packages/diagram-formats/src/mermaid/class/write.ts:82 (node, `kept` filter); reader class/parse.ts:111 (take)
- scenario: a class box with an attribute row `<<x>>` below its first divider is written as a body line `<<x>>`; `take` reads any body line matching `^<<…>>$` as an annotation, so the row moves above the name on read, with no warning.
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

<!-- done: 7 findings, files read: 35 -->
