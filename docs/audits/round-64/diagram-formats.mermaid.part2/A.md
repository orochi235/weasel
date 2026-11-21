I couldn't write `.skulkr/out/findings.md` because permission was denied, so here is the whole document instead.

# Audit round 64: diagram-formats.mermaid.part2

## Several `start` (or `end`) shapes in one state-diagram scope merge into one, and a `start` with an incoming edge reads back as an `end`
- where: packages/diagram-formats/src/mermaid/state/write.ts:41 (StateWriter.id)
- scenario: a page has two `outline: 'start'` nodes, `s1` and `s2`, at the top level, with edges `s1 → a` and `s2 → b`.
  - Every pseudo node is written as `[*]`, so the text is `[*] --> a` and `[*] --> b`.
  - `readStateDiagram` makes one `[start]` node with two edges. A node is lost, with no warning.
  - An edge `x → s1` into a start shape is written `x --> [*]`. The reader takes that as the scope's end (`pseudoId(scope, 'end')`), so `s1` comes back split into a `[start]` node and an `[end]` node.
  - An `end` shape with an outgoing edge comes back as a start.
  - The writer should warn about pseudo shapes the reader cannot keep apart, as it already warns about transitions that cross a scope.
- evidence: read (write.ts:16, 41, 122; read.ts:57-65)
- severity: medium

## Radar ids rewritten for Mermaid can collide with each other or with another id, and nothing renames them
- where: packages/diagram-formats/src/mermaid/radar/write.ts:8 (item)
- scenario:
  - Axes `a b` and `a.b` both rewrite to `a_b`. An axis `1x` rewrites to `_1x`, which another axis may already be called.
  - The written `axis a_b, a_b` reads back as two axes with the same id. A curve keyed by axis then gives both values to the first axis (`entries.find`).
  - Curve ids collide the same way, so two curves end up with one id.
  - Every other Mermaid writer in this area picks unique spellings through `mermaidIds`. This one rewrites each id on its own, so the same question gets two answers, and this answer can lose uniqueness.
- evidence: read (write.ts:9-13; parse.ts:73-88)
- severity: medium

## A sequence box or rect fill that the reader doesn't see as a leading color is written anyway, and reads back as part of the box label or is lost
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:88 (participants) and :121 (steps, region)
- scenario:
  - A box with `colors.fill: 'var(--brand)'` (or `oklch(…)`, `color-mix(…)`) and label `Team` is written `box var(--brand) Team`.
  - `leadingColor` only matches `rgb[a](`, `hsl[a](`, hex, or a bare drawable word. So the reader finds no color and reads the label as `var(--brand) Team`.
  - A region written as `rect var(--brand)` reads back with no fill and no warning. `colorAndLabel` only warns when it matches a color it cannot draw.
  - The writer guards the opposite case: a label that opens with a color gets `transparent` written before it. It never checks that its own fill reads back as a color.
- evidence: read (write.ts:87-89, 121; syntax.ts:55-58; read.ts:20-25)
- severity: medium

## The kanban writer counts ids the board never writes when deciding which generated ids to leave out, so ids shift on read-back
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:47 (leaveUnwritten)
- scenario:
  - A pool lane holds cards `card-1` and `card-3`. A node `card-2` sits outside the pool and is dropped with a warning.
  - The `IdMint` used for the check is seeded from `this.ids`. That holds every node and every lane of every container, including `card-2`.
  - So the writer predicts the reader will mint `card-1` and `card-3`, and leaves both ids out of the text.
  - The reader never sees `card-2`, so it mints `card-1` and `card-2`. The second card's id changes.
  - Other pools' lanes named `column-N` cause the same shift.
  - The fix is to seed the mint only with ids the board actually writes.
- evidence: read (write.ts:33-35, 41-50; read.ts:52-57)
- severity: low

## The kanban writer renames ids that are flowchart keywords, though the kanban reader reads them as they are
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:34 (constructor)
- scenario:
  - `mermaidIds` still applies the shared `RESERVED` set (`end`, `class`, `style`, `default`, `direction`, `graph`, …), even with the custom `id: ITEM_ID`.
  - So a card or column with id `end` is written `end_`, and `default` is written `default_`.
  - `parseKanban` reads `end[…]` fine, so the id changes on every round trip.
- evidence: read (write.ts:34; common/text.ts:60, 73)
- severity: low

## A labeled diamond in a state diagram loses its outline without a warning
- where: packages/diagram-formats/src/mermaid/state/write.ts:61 (node)
- scenario:
  - `{ outline: 'diamond', lines: ['Valid?'] }` is written as `state "Valid?" as x`, which reads back as a `roundRect`.
  - The outline warning skips `roundRect`, `bar` and `diamond`, so this diamond is dropped silently.
  - Only an empty diamond is actually written as a choice.
- evidence: read (write.ts:52-63; read.ts:127-133)
- severity: low

## A multi-line state note loses its blank lines and each line's leading spaces
- where: packages/diagram-formats/src/mermaid/state/write.ts:136 (noteLines)
- scenario:
  - Lines `['a', '', 'b']` are written with a blank line inside `note … end note`.
  - `statementsOf` drops blank lines and trims each line before `noteBody` sees them.
  - The note reads back as `['a', 'b']`, with no warning.
- evidence: read (write.ts:134-136; common/lines.ts:61, 80; parse.ts:97-105)
- severity: low

## With no name row, the requirement writer takes a field row past the divider as the box's name
- where: packages/diagram-formats/src/mermaid/requirement/write.ts:47 (nameRow)
- scenario:
  - A box's rows are `<<requirement>>`, a divider, then `id: 1`, with no name row.
  - `nameRow` ignores the divider and returns `id: 1`. The block is written `requirement "id: 1" {`, and the same row is also written as a field.
  - It should fall back to the node id instead.
- evidence: read (write.ts:30-41, 47-60)
- severity: low

## The quadrant writer writes a point's class name and classDef names without checking them, so a name the reader can't take corrupts the point or the whole file
- where: packages/diagram-formats/src/mermaid/quadrant/write.ts:76, :78
- scenario:
  - A point with `className: 'hot spot'` is written `A:::hot spot: [0.5, 0.5]`.
  - The reader's `POINT` regex only takes a class written as `[\w-]+`. So the point's name grows to `A:::hot spot` and the class is lost.
  - `classDef hot spot …` then throws (`"spot" is not a point style`), and the whole file fails to read.
  - The writer should rename or drop such a name with a warning, as the kanban and requirement writers do for field names (`fieldName`).
- evidence: read (write.ts:76-78; parse.ts:44; read.ts:30-33)
- severity: low

## The chart writers drop the page name without a warning when it differs from the chart title
- where: pie/write.ts:8, packet/write.ts:11, quadrant/write.ts:57, radar/write.ts:31, xychart/write.ts:33, timeline/write.ts:12
- scenario:
  - A pie page named `Q3 budget` whose data has no title, or a different one, is written with no front matter, so the page name is lost.
  - The readers name the page by its title, and fall back to the front-matter title (`readPageName`).
  - The kanban, mind map, state, requirement and sankey writers all write `titleLines`. These six writers neither write the name nor warn that it was dropped.
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

<!-- done: 10 findings, files read: 34 -->