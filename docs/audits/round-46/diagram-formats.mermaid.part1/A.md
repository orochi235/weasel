# Findings — diagram-formats.mermaid.part1 (round 46)

## A block group whose id looks like `block-N` is written anonymous, so edges and styles naming it read back as a new block
- where: packages/diagram-formats/src/mermaid/block/write.ts:71 (BlockWriter.group), with :87-88 (link) and :101-104 (styles)
- scenario: read `block-beta\n  block:block-1\n    a\n  end\n  x --> block-1\n  style block-1 fill:#f00` (GROUP and WORD both accept `block-1` as a named id). The page holds container `block-1` with an edge from `x` and a fill. On write, `ANONYMOUS.test('block-1')` is true and there is no span, so the group is written as a bare `block` with no id, while the link and style lines still name it, as `this.id('block-1')` = `block_1`. Reading that back mints a fresh `block-1` for the anonymous group, and `x --> block_1` creates a new rectangle block `block_1` (it isn't in `groupIds`). The edge now goes to a phantom node, and the group's fill is lost. The same happens to any page whose container is named `block-<n>` (one the reader minted, or one from another format) when an edge or a colour refers to it. A group should be written anonymous only when nothing else names it: no edge end, no style, no columns keyed to it.
- evidence: read
- severity: medium

## A gitGraph that renames its main branch (`mainBranchName`) is refused, though `GitGraphData.mainBranch` can hold the name
- where: packages/diagram-formats/src/mermaid/gitgraph/read.ts:21-28 (readMermaidGitGraph); packages/diagram-formats/src/mermaid/common/header.ts:27-37 (frontMatter)
- scenario: `---\nconfig:\n  gitGraph:\n    mainBranchName: develop\n---\ngitGraph\n  commit\n  branch feature\n  checkout develop\n  commit` (or the same name set by a `%%{init: {'gitGraph': {'mainBranchName': 'develop'}}}%%` directive) is valid Mermaid. `frontMatter` reads only `title`, and `statementsOf` only counts directives, so `data.mainBranch` is never set. `replayGitGraph` then takes `main` as the main branch and fails on `checkout develop` as a branch never made, so the reader throws on a file Mermaid draws. The writer, for its part, knows Mermaid renames main: it warns when it writes a non-`main` main branch as `main`. The reader should take `mainBranchName` from the front matter's (or the directive's) config into `mainBranch`, or at least warn instead of throwing.
- evidence: read
- severity: medium

## Front matter `config:` is dropped silently, though the same settings in a `%%{init}%%` directive are reported
- where: packages/diagram-formats/src/mermaid/common/header.ts:27-37 (frontMatter); packages/diagram-formats/src/mermaid/common/lines.ts:92-93 (readPageName)
- scenario: `---\nconfig:\n  theme: dark\n  look: handDrawn\n---\nclassDiagram\n  class A` reads with no warning. Written instead as `%%{init: {"theme": "dark"}}%%\nclassDiagram\n  class A`, it warns "Mermaid configuration directives were dropped." Mermaid treats the two as the same configuration, so dropping it is one decision, answered two ways: only the directive's loss is reported. `frontMatter` should report keys besides `title` (a `config` block in particular) so that `readPageName` warns as it does for directives. The flowchart lexer reaches the same `frontMatter`, so the flowchart is affected too.
- evidence: read
- severity: low

## An empty front matter block (`---\n---`) is not skipped, so a file `detect` accepts fails to read as any kind
- where: packages/diagram-formats/src/mermaid/common/header.ts:28 (frontMatter), compared with :43-47 (headerWord)
- scenario: `---\n---\nclassDiagram\n  class A`. `headerWord` skips lines 0–1 as front matter and finds `classDiagram`, so `detect` and `kindOf` pick the class reader. But `frontMatter`'s regex `^---[ \t]*\n([\s\S]*?)\n---` needs a `\n` before the closing `---`, which the empty block doesn't have, so it returns `length: 0`. `statementsOf` then takes `---` as the header, and `parseClassDiagram` throws `expected a classDiagram header, found "---"`. The flowchart lexer, starting at offset 0, lexes `---` as a link and throws "expected a flowchart header". Every kind fails the same way. The two front-matter scanners disagree about the same text, and the regex should allow an empty body (`\n(?:([\s\S]*?)\n)?---`).
- evidence: read
- severity: low

## The flowchart reader ignores `accTitle` for the page name and drops `accTitle`/`accDescr` as unknown statements, where every other kind uses `readPageName`
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:156-157 (MermaidReader.walk `other` branch), :245-246 (readFlowchart page name); parse.ts:56,74
- scenario: `flowchart TD\n  accTitle: Checkout flow\n  A --> B` gives a page with no name, and a warning that lists `accTitle` among "Mermaid statements a diagram does not hold were dropped". The same `accTitle: Checkout flow` in a `classDiagram`, `erDiagram`, `block-beta` or `architecture-beta` names the page "Checkout flow" through `readPageName` (title, else accTitle), and an `accDescr` there gets its own "accessible descriptions were dropped" warning. The flowchart is the most common kind, and it answers the same question differently. Its reader should name the page from `accTitle` when there's no front-matter title, and report the two the way `readPageName` does.
- evidence: read
- severity: low

## The architecture writer replaces a connector port that isn't a compass side with R/L, with no warning
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:71 (ArchWriter.end)
- scenario: an edge on an architecture page with `fromPort: 'ne'` (or any port other than `n`/`s`/`e`/`w`, such as a node's own named port) is written as `a:R -- L:b`. `PORT_SIDES.get('ne')` is undefined, so it falls back to `R`/`L` silently, and the port is lost with no warning. The flowchart writer warns "Mermaid has no ports; connectors' ports were dropped" in the same situation. The writer should warn when an edge's port is given but isn't a side.
- evidence: read
- severity: low

## The class writer writes a `note` shape's text from `lines` only, so a note whose text is in `rows` is written empty
- where: packages/diagram-formats/src/mermaid/class/write.ts:104 (ClassWriter.noteLines)
- scenario: a `note`-outline node built with `rows: [{kind:'label', text:'remember'}]` and no `lines` (rows are how class and ER boxes carry text, and `classParts`/`entityParts` read them) is written as `note ""`, so the text is lost with no warning. Every other text path in these writers goes through `nodeLines`/`rowLines`, which read rows. `noteLines` should use `nodeLines(node, warnings, 'Mermaid')` too.
- evidence: read
- severity: low

## The gantt writer writes `after <id>` for an id it just dropped, leaving the next task pointing at a task that doesn't exist
- where: packages/diagram-formats/src/mermaid/gantt/write.ts:21-25 (taskItems), :69-72 (writeMermaidGantt loop)
- scenario: a gantt whose first task is `{ name: 'Plan', id: 'a', start: {kind:'previous'}, end: <3d> }`, followed by `{ name: 'Build', id: 'b', start: {kind:'previous'}, end: <2d> }`. For `Plan`, `before` is undefined, so line 24 drops `a`, with a warning, and writes `Plan :3d`. For `Build`, `before.id === 'a'`, so line 23 writes `Build :b, after a, 2d`. Read back, `Build` starts `after a`, but no task has id `a` any more. Build was meant to start where Plan ends, and it now names a missing task, so its start no longer resolves. The same happens after any task whose id the writer dropped (one with start `previous` whose own predecessor had no id), and to an `until` end naming such an id. `before` should count as having an id only when that id was actually written; otherwise the task should be written with no start (`previous`), which already means "after the task above".
- evidence: read
- severity: medium

## `metaEnd` treats an apostrophe inside a plain metadata value as an opening quote, so `@{ label: it's done }` throws "never closed"
- where: packages/diagram-formats/src/mermaid/common/meta.ts:20-30 (metaEnd); reached from flowchart/lex.ts:136-140 (MermaidLexer.mark)
- scenario: `flowchart TD\n  A@{ shape: rect, label: it's done }`. `metaEnd` sees the `'` in `it's`, enters quote mode, never meets another `'`, and returns -1, so the lexer throws "node metadata is never closed". In YAML (which Mermaid parses `@{…}` as), a quote opens a quoted scalar only where it starts the value, and `metaOf`'s own regex agrees: its `'[^']*'` alternative only applies right after `key:`. A plain value holding an apostrophe, or a `"` in mid-word, is valid, and `metaOf` alone would read it. `metaEnd` should enter quote mode only for a quote that opens a value (after `:` or `,` and any whitespace).
- evidence: read
- severity: low

## C4 `<<person_db>>`/`<<person_queue>>` rows are accepted as a kind but written as a macro the reader refuses, so the element is lost
- where: packages/diagram-formats/src/mermaid/c4/kinds.ts:43 (kindOfStereotype), compared with :21 (kindOfMacro) and :29-32 (macroOf)
- scenario: a C4 page node whose first row is `<<person_db>>` (or `<<external_person_queue>>`). `kindOfStereotype`'s regex allows a `_db`/`_queue` variant on `person`, so `elementParts` gives `{ base: 'person', variant: 'db' }`, and `macroOf` writes `PersonDb(alias, "Name")`. On read, `kindOfMacro('PersonDb')` returns null, because it refuses any variant on `Person`, so the line falls through to "Mermaid C4 statements a diagram does not hold were dropped: PersonDb". The element vanishes, and every `Rel` to it is then dropped as "relationships to elements never declared". The two functions disagree about which kinds exist. `kindOfStereotype` should refuse a person variant (and treat the row as text, leaving the kind to the outline), or the writer should drop the variant with a warning.
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

<!-- done: 10 findings, files read: 35 -->
