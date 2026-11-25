# Audit round 72 — diagram-formats.mermaid.part1

## Architecture writer joins a service's text lines with spaces and never warns
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:15 (oneTitle), :62 (ArchWriter.node)
- scenario: a shape whose text is two lines (`["web", "tier"]`) is written `service a[web tier]`. `oneTitle` joins the lines with `' '` before `oneLine` looks for a line break, so `oneLine` never finds one and never warns. The reader passes the title through `textLines` (architecture/read.ts:70), which does read `<br>` as a break, so the lines could have been kept (`mermaidEscaped(lines)` joins with `<br>`). As written, the line structure is lost with no warning.
- evidence: read
- severity: low

## Architecture writer drops an empty service title, and the reader then labels the service with its id
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:63 (ArchWriter.node)
- scenario: a `roundRect` shape with no text is written `service a`, with no `[…]`. readArchitecture reads `textLines(s.title ?? s.id)` (read.ts:70), so the shape comes back with the text `a`. An unlabeled shape gains a label on a round trip, with no warning.
- evidence: read
- severity: low

## Block writer drops connector colors and never warns
- where: packages/diagram-formats/src/mermaid/block/write.ts:84 (BlockWriter.link)
- scenario: an edge with `colors.stroke` or `colors.label` set is written as a bare `a --> b`. `link()` only reads dash, width and the markers, and nothing writes or warns about the colors. The node styles are written as `style` lines, and the architecture and C4 writers warn about or write edge colors. Here they vanish silently.
- evidence: read
- severity: low

## C4 writer turns a container description shaped like `[x]` into its technology
- where: packages/diagram-formats/src/mermaid/c4/kinds.ts:80 (elementParts)
- scenario: `Container(a, "Api", "", "[beta]")` reads as rows `<<container>>`, `Api`, `[beta]` (the technology is empty, so it gets no row, and the description is wrapped). On write, elementParts takes `rest[1]` = `[beta]` as the technology, giving `Container(a, "Api", "beta")`. The description becomes the technology. For a person or system, the same row raises the spurious "people and systems have no technology" warning.
- evidence: read
- severity: low

## Class diagram reader throws on nested generics
- where: packages/diagram-formats/src/mermaid/class/parse.ts:35-36 (ID, CLASS)
- scenario: `class Foo~List~int~~` (Mermaid's spelling of `Foo<List<int>>`) does not match CLASS, because `~([^~]*)~` takes `~List~` and leaves `int~~`. It matches no other form either, so parseClassDiagram throws "cannot read … as a class diagram statement". A relation `A~List~int~~ --> B` fails the same way through ID's `~[^~\s]*~`. That Mermaid supports nested generics is my recollection of its docs; I did not check it against Mermaid here.
- evidence: read (Mermaid's support is inferred)
- severity: low

## A gantt task named `accTitle` or `accDescr` is written as a line that reads back as accessibility text
- where: packages/diagram-formats/src/mermaid/common/text.ts:52 (lineOpening); packages/diagram-formats/src/mermaid/gantt/write.ts:90 (writeMermaidGantt)
- scenario: lineOpening tests `/^acc(?:Title|Descr)\s*[:{]/` against the bare name `accTitle`, which has no `:`, so it leaves the name alone. The writer then appends ` :items`, giving `    accTitle :a, 2024-01-01, 1d`. statementsOf (lines.ts:62) matches `^accTitle\s*:`, so the task disappears and its items become the accessible title, which readPageName may then use as the page name. The name should be spelled `#97;ccTitle`, because it is the whole line that has to read as a statement, not the name alone.
- evidence: read
- severity: medium

## A journey step named `accTitle` or `accDescr` reads back as accessibility text
- where: packages/diagram-formats/src/mermaid/journey/write.ts:16 (stepName), :51
- scenario: stepName only guards `accTitle {` / `accDescr {`. A step named `accTitle` is written `    accTitle: 3: Me`, and statementsOf reads it as `accTitle` with the text `3: Me`, so the step is lost without a warning. A step named `accDescr` does the same, through `accDescr: …`.
- evidence: read
- severity: low

## The gantt, gitGraph and journey writers drop a page name that differs from the chart title, without the warning the other chart kinds give
- where: packages/diagram-formats/src/mermaid/gantt/write.ts:73, packages/diagram-formats/src/mermaid/gitgraph/write.ts:60, packages/diagram-formats/src/mermaid/journey/write.ts:30
- scenario: a plot page named `Q3 plan` whose gantt or journey data has no title, or a different one, is written with only `data.title`, and `page.name` is never read. The same goes for a gitGraph page that readMermaidGitGraph named from `accTitle` (data.title stays unset), which writes back with no name at all. The pie, packet, quadrant, radar, sankey, timeline and xychart writers all call `warnDroppedPageName` (lines.ts:122) for this case. These three never do, so the name is lost silently. Two answers to one decision.
- evidence: read
- severity: low

## The gantt and journey readers drop the accessible title silently when a title statement names the chart
- where: packages/diagram-formats/src/mermaid/gantt/read.ts:43-55, packages/diagram-formats/src/mermaid/journey/read.ts:40-44
- scenario: `gantt` / `title Plan` / `accTitle: Roadmap`, with no front matter. `readPageName(src, warnings)` is called without its `own` argument, so it sees no title, returns `Roadmap` without warning, and the page is then named `Plan`. The accessible title vanishes with no warning. readPageName's `own` parameter exists for exactly this case: it warns "Mermaid accessible titles were dropped", and also covers the front-matter-vs-statement warning that both readers duplicate by hand. C4 (c4/read.ts:152-156) handles this case.
- evidence: read
- severity: low

## The gantt writer writes task ids raw, so an id holding a comma or starting with a tag word's syntax breaks the line
- where: packages/diagram-formats/src/mermaid/gantt/write.ts:43-45 (taskItems)
- scenario: a GanttTask with `id: 'a,b'` (an id from any source other than Mermaid) is written `T :a,b, 2024-01-01, 1d`. parseGanttTask splits the items on `,` and gets four, then throws "a task takes an id, a start and an end after its tags, and no more", so the exported file does not read back. taskIds renames only ids that are tag words. It never cleans `,`, or the whitespace that `trim` strips.
- evidence: read
- severity: low

## The flowchart and block readers read lean-left and inverted-trapezoid shapes as their mirror images, without a warning
- where: packages/diagram-formats/src/mermaid/flowchart/read.ts:21-25 (SHAPE_OUTLINES), used by block/read.ts:46
- scenario (shapes): `A[\text\]` (lean-left) reads as `parallelogram`, the same outline as `[/text/]`, and `A[\text/]` (inv-trapezoid) reads as `trapezoid`. No outline in `@weasel-js/diagram` is the mirrored one, so the shape is drawn the other way round. Both readers stay silent, though the block reader warns when it drops a block arrow's direction (block/read.ts:45), and the flowchart writer then writes `[/ /]` and `[/ \]`.
- evidence: read
- severity: low

## The flowchart lexer skips the newlines inside `@{ … }` metadata without counting them, so every later line number is wrong
- where: packages/diagram-formats/src/mermaid/flowchart/lex.ts:145-149 (MermaidLexer.mark)
- scenario: `A@{\n  shape: rect,\n  label: "x"\n}` spans four lines. metaEnd scans across the newlines, and `this.i = end + 1` jumps past them, but `this.line` is never advanced, unlike `directive()` (lex.ts:128) and `descrBlock()` (lex.ts:202). Every token after it carries a line number 3 too low, so a later parse error names the wrong line. A related problem: if the pairs are separated by newlines rather than commas (YAML block style), metaOf's `[^,]*?` value runs across the newline, so `shape` takes the value `rect\n  label: "x"` and the label is lost. That Mermaid accepts newline-separated pairs is inferred from its reading `@{}` as YAML.
- evidence: read (line counting); inferred (Mermaid's YAML form)
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

<!-- done: 12 findings, files read: 35 -->
