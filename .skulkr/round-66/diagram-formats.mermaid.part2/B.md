# Audit round 66 — diagram-formats.mermaid.part2

## Kanban writer writes a card once per lane naming it, and its own reader then rejects the board
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:68 (KanbanWriter.board), also :41 (leaveUnwritten)
- scenario: a pool whose lanes `todo` and `doing` both list node `a` (or one lane listing `a` twice). `graphOut` claims `a` for the first lane and warns "puts a shape or box in one box only; these were left out of the others", but `board()` iterates `lane.members` straight from the container data and emits `    a[…]` under both columns. `readKanban` on that text throws `"a" names two items`. If `a` has a generated id like `card-2` and is left unwritten, the reader instead mints two different cards. Either way the output contradicts the warning. It should write each node once (skip ids already in `this.written`, or walk the claimed clusters), and `leaveUnwritten` should count each card once too.
- evidence: read
- severity: medium

## State writer drops a pool's direct members and turns nested containers in a pool into regions
- where: packages/diagram-formats/src/mermaid/state/write.ts:71 (StateWriter.cluster)
- scenario: a pool container with `lanes` and also `members: ['s1', 'inner']`, where `s1` is a node and `inner` is a container. `graphOut` puts `s1` in the pool cluster's `nodes` and `inner` in its `clusters` next to the lanes. For a pool, `cluster()` only loops over `c.clusters`, calling `scope(lane)` for each one. So `s1` is never written (no `state` line, no label, no warning), and `inner` is written as a `--`-separated region whose `state inner {` header and label are lost. Edges whose `[*]` sits directly in the pool, where `edgeScope` is the pool id, are never written either. What should happen: write `c.nodes` and non-lane clusters, or warn that they were dropped.
- evidence: read
- severity: medium

## Sequence writer silently drops a box none of whose members is in `participants`
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:77 (SequenceWriter.participants)
- scenario: `data.participants = []` (or not listing the box's members), `boxes = [{ id: 'b1', label: 'Team', members: ['A', 'B'] }]`, and the steps hold a message A->>B. A box is written only when the loop over `data.participants` reaches its first member, so this box never gets a `box … end` block. Line 92 does handle undeclared members (`declare({ id: m }, 2)`), but only inside a box some declared participant opened. The box is dropped with no warning: A and B are named, so the "name no participant" warning never fires.
- evidence: read
- severity: low

## Sankey writer drops a page name that is not the chart's title without a warning
- where: packages/diagram-formats/src/mermaid/sankey/write.ts:12 (writeMermaidSankey)
- scenario: a sankey plot page with `name: 'Flows'` and no `data.title`, or a different one. The writer only writes `titleLines(data.title)`, so the page name is lost. Every sibling chart writer (pie, packet, quadrant, radar, timeline, xychart) calls `warnDroppedPageName` for exactly this case; sankey never does, so the same decision gets two different answers.
- evidence: read
- severity: low

## Sequence writer gives an uncolored `region` a gray fill that reads back as a color
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:128 (SequenceWriter.steps)
- scenario: a `region` fragment with no `colors` is written as `rect rgba(128, 128, 128, 0.1)`. `colorAndLabel` in read.ts reads that back as `colors: { fill: 'rgba(128, 128, 128, 0.1)' }`, so a round trip adds a fill the page never had. The reader already treats `transparent` as "no color" (read.ts:24), which the box writer relies on (write.ts:88). So the region writer could write `rect transparent`; instead the two disagree.
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

<!-- done: 5 findings, files read: 34 -->
