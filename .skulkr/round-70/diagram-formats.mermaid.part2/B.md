# Findings: diagram-formats.mermaid.part2

## Mind map writer counts a self-loop as the node's parent, so a real root can be dropped
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:24-30 (writeMindmap)
- scenario: nodes `[B, A]`, edges `[A→A, A→B]`. The loop over edges runs `hasParent.add(e.to)` for the self-loop `A→A`, so A counts as having a parent. Then `A→B` gives B a parent, and no node is parentless. `root` falls back to `nodes[0]` = B. Visiting B reaches nothing, so A and the edge A→B are dropped under the "one tree" warning. The writer should skip `e.from === e.to`, which leaves A as the root of the tree A→B. A self-loop also lists the node among its own children.
- evidence: read
- severity: medium

## Sequence writer writes a note over no participants as a line its own reader refuses
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:121-123 (SequenceWriter.steps)
- scenario: a note step with `over: []` (for example, one whose participants were all removed) is written as `Note over : text`. In `parseSequence`, `NOTE` needs at least one non-colon character after `over\s+`, so the note doesn't match. `MESSAGE` doesn't match either, and `readStatement` throws "is not a sequence diagram statement". The writer should drop the note with a warning, or write it over some participant.
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

<!-- done: 2 findings, files read: 34 -->
