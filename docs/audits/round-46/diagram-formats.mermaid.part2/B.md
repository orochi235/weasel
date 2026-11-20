# Audit round 46 — diagram-formats.mermaid.part2

## Mermaid mind map writer writes no nodes at all when every shape has a parent (a cycle)
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:29 (writeMindmap)
- scenario: a page whose connectors form a cycle, e.g. nodes `a`, `b`, `c` with edges a→b, b→c, c→a (or one node with a self-loop a→a). Every node lands in `hasParent`, so `roots` is empty, `visit` never runs, and the output is the bare `mindmap` header with the warning "shapes outside the first root's were dropped": the whole page is lost. It should still pick a root (e.g. the first node, skipping the edge that closes the cycle) and write the tree it spans.
- evidence: read
- severity: medium

## Mermaid xychart parser silently swallows an unclosed `%%{` directive or `accDescr {` block, where every other kind refuses it
- where: packages/diagram-formats/src/mermaid/xychart/parse.ts:118-122, 131-135 (parseXyChart)
- scenario: `xychart-beta\n%%{init: {}\nbar [1,2]`: the `while` runs to the last line and the loop ends; likewise `accDescr {` with no `}` sets `block` until EOF. The chart reads as empty with only a "dropped" warning. `statementsOf` (common/lines.ts:50, :67), which every other kind in this area uses, throws "a directive opened here is never closed" / "an accDescr block is never closed" for the same text (commit 9eb2725bcc made that the rule). The same input is answered two ways depending on the chart kind.
- evidence: read
- severity: low

## Mermaid state writer writes a note joined to a start or end shape as `note right of [*]`, which its reader refuses
- where: packages/diagram-formats/src/mermaid/state/write.ts:109-110 (StateWriter.noteLines)
- scenario: a state page with a `start` shape `s`, a `note` shape `n1`, and the note edge n1→s (the shape `readStateDiagram` gives a note). `this.id(target.to)` returns `[*]` for a pseudo state, so the line is `note right of [*] : text`. In parse.ts NOTE takes `[\w-]+` as the target, and no other pattern matches, so `readStateDiagram` throws "cannot read … as a state diagram statement" on the writer's own output. The writer should drop such a note with a warning (as it does for a note beside nothing) or attach it elsewhere.
- evidence: read
- severity: medium

## Mermaid state writer drops a note with no outgoing edge but still writes the edge pointing at it, which reads back as a phantom state
- where: packages/diagram-formats/src/mermaid/state/write.ts:85-89, 103-107 (edgeScope, noteLines)
- scenario: a page where a state `A` has an edge A→n1 to a `note` shape `n1` (drawn from the state to the note, not the note to the state). `node()` skips `n1` because it is a note, and `noteLines` drops it ("notes beside none were dropped") because no edge leaves it. But `edgeScope` excludes only edges *from* a note, so `A --> n1` is still written as a transition, and the reader makes a plain state named `n1`. The note that was reported as dropped comes back as a state box with its id for text. Either edges to a note should be skipped too, or a note whose only edge arrives at it should be written beside the edge's other end.
- evidence: read
- severity: low

## Mermaid requirement writer silently drops a box's text rows past its name that sit before any divider, and rows of other kinds
- where: packages/diagram-formats/src/mermaid/requirement/write.ts:30-37 (writeBlock)
- scenario: a box with `lines: ['Login', 'must lock after 3 tries']` and no rows/divider (any shape drawn in another notation). `blockName` takes `Login`; `writeBlock` turns label rows into fields only when `past` (after a divider) is set, so the second line matches no branch and disappears with no warning. Likewise a row whose kind is not label/field/divider is ignored silently. Every other drop in this writer warns ("rows that name none were dropped", "containers … were dropped"); this path should too, or write the line as a field.
- evidence: read
- severity: low

## Mermaid requirement writer turns `"` into `'` in a quoted name without a warning, and can merge two blocks into one
- where: packages/diagram-formats/src/mermaid/requirement/write.ts:15 (nameOf), :52-61 (blockNames)
- scenario: two boxes named `say "hi"` and `say 'hi'`. `blockNames` sees them as distinct, but `nameOf` writes both as `"say 'hi'"`, so the reader's `blocks` map (keyed by name) keeps one block, the other's fields are overwritten, and both boxes' relationships attach to it. A single name holding `"` is also changed with no warning (radar and kanban warn on the same rewrite). Uniqueness should be decided on the name as written.
- evidence: read
- severity: low

## Mermaid sequence writer splits a box whose members are not adjacent in the participant list into two boxes, silently
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:65-81 (SequenceWriter.participants)
- scenario: `participants: [A, B, C]`, `boxes: [{ id: 'b1', label: 'Svc', members: ['A', 'C'] }]`. The loop opens `box Svc`, writes A, closes it at B (not in a box), then opens `box Svc` again for C. `readMermaidSequence` reads two boxes `b1` and `b2`, each with one member, and no warning says the box was split. The writer should either reorder the box's members together or warn.
- evidence: read
- severity: low

## Mermaid sequence writer writes a non-finite `autonumber` that its reader refuses
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:140 (writeMermaidSequence)
- scenario: `data.autonumber = NaN` (or `Infinity`) writes `autonumber NaN`; `SequenceReader.numbering` (read.ts:136-137) throws "is not a start and a step" on it, so the writer's output does not read back. The other writers in this area drop a non-finite number with a warning (radar max/min/ticks, xychart ranges, pie and sankey values); this one should too.
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

<!-- done: 8 findings, files read: 34 -->
