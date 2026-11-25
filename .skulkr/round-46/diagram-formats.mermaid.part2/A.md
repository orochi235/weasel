Writing `.skulk/out/findings.md` was denied, so the whole document follows here instead.

# Audit round 46 — diagram-formats.mermaid.part2

## Mind map writer silently drops every connector into a node that already has a parent
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:24-28 (writeMindmap)
- scenario: a page with edges A→B, A→C, B→D, C→D (a diamond). The loop keeps the first edge into D and `continue`s past `C→D` because `hasParent.has('D')`. Every node is still reached, so `seen.size === nodes.length` and the "outside the first root" warning never fires. The export loses the connector C→D with no warning. It should warn that a mind map holds a tree and other connectors were dropped.
- evidence: read
- severity: medium

## Mind map writer writes an empty map when every node has a parent (a cycle)
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:29-39 (writeMindmap)
- scenario: edges root→a, a→root (or a self-loop root→root on a one-node page). `hasParent` then holds every node, so `roots` is empty and `visit` never runs. The output is a bare `mindmap` header, and the warning says only that shapes "outside the first root's" were dropped. Every shape is lost, where the writer could start from the first node, as it does when there are several roots.
- evidence: read
- severity: medium

## Sequence writer splits one box into several, or drops members, when its participants are not contiguous or are created
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:61-82 (SequenceWriter.participants)
- scenario: participants [p1, p2, p3] with box b = {members: [p1, p3]}. p1 opens `box`, p2 closes it with `end`, and p3 opens a second `box` with the same label and color. On reread, SequenceReader makes two boxes (b1, b2). A box member that is the head of a `create` step is skipped here and declared later inside the steps, outside any box, so it leaves the box. A member named only by steps (not in `data.participants`) is never declared in the box either. None of these warn.
- evidence: read
- severity: medium

## xychart reader throws on accTitle/accDescr written without a colon attached to the keyword
- where: packages/diagram-formats/src/mermaid/xychart/parse.ts:84-88,136-137 (statementOf / parseXyChart)
- scenario: `accTitle : Sales` or `accTitle:Sales` inside an `xychart-beta`. The keyword is `^(\S+)`: `accTitle` in the first case and `accTitle:Sales` in the second. Neither is the `'accTitle:'` case, so both throw "is not an xychart statement". Every other kind reads its lines through `statementsOf`, which accepts `acc(Title|Descr)\s*:` (common/lines.ts:54). So xychart answers the same syntax differently from its sibling kinds.
- evidence: read
- severity: medium

## xychart reader rejects unquoted axis titles
- where: packages/diagram-formats/src/mermaid/xychart/parse.ts:48-64 (leadingTitle / axisBody)
- scenario: `y-axis Revenue 4000 --> 11000` or `x-axis Months [jan, feb]`. `leadingTitle` takes only a double-quoted title, so `axisBody` gets `Revenue 4000 --> 11000` and throws "neither a category list nor a range". Mermaid's xychart grammar takes the axis title as `text`, an alphanumeric word or a string, so these files render in Mermaid but fail to import.
- evidence: inference (Mermaid's grammar recalled, not checked in this tree)
- severity: medium

## xychart reader silently drops the rest of the file after a `%%{` directive that is never closed
- where: packages/diagram-formats/src/mermaid/xychart/parse.ts:118-121 (parseXyChart)
- scenario: `xychart-beta\n%%{init: {...}\nbar [1,2]`. The `while` loop runs `k` to the last line and stops there without throwing. The chart imports with no series and only a "directives were dropped" warning. `statementsOf` throws "a directive opened here is never closed" (common/lines.ts:50), and so does the sequence parser.
- evidence: read
- severity: low

## Sequence and xychart readers drop accTitle where every other kind names the page by it
- where: packages/diagram-formats/src/mermaid/sequence/parse.ts:81; packages/diagram-formats/src/mermaid/xychart/read.ts:38-39
- scenario: a `sequenceDiagram` or `xychart-beta` with `accTitle: Login flow` and no title. The page has no name and a warning says it was dropped. A pie, packet, quadrant, kanban, state or requirement diagram with the same line gets the page name "Login flow" through `readPageName` (common/lines.ts:96). The same decision is answered two ways.
- evidence: read
- severity: low

## State writer reads a note's text from `lines` only, and misreads notes it cannot pair with one outgoing edge
- where: packages/diagram-formats/src/mermaid/state/write.ts:101-112 (StateWriter.noteLines); state/write.ts:85-89 (edgeScope)
- scenario:
  1. A `note` shape whose text is in `rows` writes an empty note: line 104 reads `.lines`, while every other shape goes through `nodeLines`/`rowLines`, which reads rows.
  2. A note whose edge runs from a state to the note has no `from === id` edge. The note is dropped, and `edgeScope` returns `null` for that edge, so `X --> note-1` is written and reread as a new plain state labeled "note-1".
  3. A note attached to a start or end shape writes `note right of [*]`, which every state pattern rejects, so the reread throws.
  4. Edges from a note past its first are dropped silently.
- evidence: read
- severity: low

## State reader drops a class assigned to `[*]`
- where: packages/diagram-formats/src/mermaid/state/read.ts:69-72,80; state/parse.ts:66-67
- scenario: `[*]:::start --> A` together with `classDef start fill:#f00`. The parser emits `assign` with id `[*]`, but the node is created under `pseudoId(scope, 'start')` (`[start]`). `styles.colorsOf('[start]')` never matches, so the color is lost, with no warning.
- evidence: read
- severity: low

## State writer moves a top-level state into a composite when a composite's `[*]` connects to it
- where: packages/diagram-formats/src/mermaid/state/write.ts:81,85-89 (scope / edgeScope); graphRead.ts:78-82 (Membership.place)
- scenario: a top-level state X, and a composite C whose start shape has an edge to X. The edge is written inside C's block because it has a `[*]` there. On reread, X was placed at top level first, then `place(X, C)` sees `was === null` with a non-null cluster and moves X into C. X changes container across a round trip, with no warning.
- evidence: read
- severity: low

## Kanban writer drops or renames ids the board could keep
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:8,28,31-33 (GENERATED / head)
- scenario:
  1. Any id matching `column-N` or `card-N` is written with no id, on the assumption that the reader regenerates it. The reader numbers unnamed cards by their place among unnamed ones, so after a deletion or reorder (cards `card-2`, `card-3` left), export and reimport give `card-1`, `card-2`. A deliberately chosen id like `column-7` is lost the same way.
  2. `mermaidIds(..., { unicode: true })` allows no `-` and no leading digit, while the kanban reader's ITEM accepts both (`[\p{L}\p{N}_][\p{L}\p{N}_-]*`). So `todo-list` is rewritten to `todo_list` and `2024` to `n2024`, with no need.
- evidence: read
- severity: low

## Requirement writer merges two boxes whose names differ only in `"` vs `'`
- where: packages/diagram-formats/src/mermaid/requirement/write.ts:15,51-61 (nameOf / blockNames)
- scenario: boxes named `say "hi"` and `say 'hi'`. `blockNames` makes names distinct before `nameOf` rewrites `"` to `'`, so both are written as `requirement "say 'hi'" {`. The reader's `blocks.set` keeps one, and the two boxes' relationships collapse onto it. No warning about the quote rewrite is given either.
- evidence: read
- severity: low

## Requirement writer drops colors on a box whose name is quoted, with no warning
- where: packages/diagram-formats/src/mermaid/requirement/write.ts:84-87
- scenario: a box named "Login page" with `colors.fill` set. `/^[\w-]+$/` fails, so no `style` line is written and nothing is added to `warnings`. Other dropped attributes on this path warn.
- evidence: read
- severity: low

## Radar reader ignores accTitle when the title statement is empty
- where: packages/diagram-formats/src/mermaid/radar/read.ts:21-24
- scenario: `radar-beta\n  accTitle: Skills\n  title\n  axis a`. `parsed.title` is `''`, so it is spread into the source as `title: ''`. `readPageName` then returns `'' ?? accTitle`, which is `''`, and `name` becomes `'' || ''`. The page is unnamed, and the "accessible titles were dropped; the page is named by the title" warning fires though no title names it.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/mermaid/kanban/parse.ts
packages/diagram-formats/src/mermaid/kanban/read.ts
packages/diagram-formats/src/mermaid/kanban/write.ts
packages/diagram-formats/src/mermaid/mindmap/parse.ts
packages/diagram-formats/src/mermaid/mindmap/read.ts
packages/diagram-formats/src/mermaid/mindmap/write.ts
packages/diagram-formats/src/mermaid/packet/read.ts
packages/diagram-formats/src/mermaid/packet/write.ts
packages/diagram-formats/src/mermaid/pie/read.ts
packages/diagram-formats/src/mermaid/pie/write.ts
packages/diagram-formats/src/mermaid/plots.fixture.ts
packages/diagram-formats/src/mermaid/quadrant/parse.ts
packages/diagram-formats/src/mermaid/quadrant/read.ts
packages/diagram-formats/src/mermaid/quadrant/write.ts
packages/diagram-formats/src/mermaid/radar/parse.ts
packages/diagram-formats/src/mermaid/radar/read.ts
packages/diagram-formats/src/mermaid/radar/write.ts
packages/diagram-formats/src/mermaid/requirement/parse.ts
packages/diagram-formats/src/mermaid/requirement/read.ts
packages/diagram-formats/src/mermaid/requirement/write.ts
packages/diagram-formats/src/mermaid/sankey/read.ts
packages/diagram-formats/src/mermaid/sankey/write.ts
packages/diagram-formats/src/mermaid/sequence/parse.ts
packages/diagram-formats/src/mermaid/sequence/read.ts
packages/diagram-formats/src/mermaid/sequence/syntax.ts
packages/diagram-formats/src/mermaid/sequence/write.ts
packages/diagram-formats/src/mermaid/state/parse.ts
packages/diagram-formats/src/mermaid/state/read.ts
packages/diagram-formats/src/mermaid/state/write.ts
packages/diagram-formats/src/mermaid/timeline/read.ts
packages/diagram-formats/src/mermaid/timeline/write.ts
packages/diagram-formats/src/mermaid/xychart/parse.ts
packages/diagram-formats/src/mermaid/xychart/read.ts
packages/diagram-formats/src/mermaid/xychart/write.ts

<!-- done: 14 findings, files read: 34 -->