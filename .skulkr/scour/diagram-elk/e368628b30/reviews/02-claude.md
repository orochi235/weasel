## A centered edge label (offset 0) gets ELK room beside its wire, but the diagram draws it centered on the wire
- where: packages/diagram-elk/src/toElk.ts:174 (labelRoom)
- scenario: an edge whose `label` is `{ width: 80, height: 20 }` with no `offset` (the default, "centers the label on the wire") goes to ELK with only its size and no `elk.edgeLabels.inline`, so ELK layered places the label dummy beside the edge, with the wire running along one side of the box. `planFrom` then takes the box center's nearest point on the route as `near` (elkPlan.ts:160), which lands on the wire at the box's edge, and the diagram draws the label centered there: half of it sits in the room ELK reserved, the other half (40 units here) on the side ELK left for neighbors at `nodeGap`, so it can overlap a neighboring node or wire. It should go in inline, as the offset case already does, so the room ELK leaves is centered on the wire where the label is drawn. Commit d1cffb2ce5 fixed this mismatch for `offset ≠ 0` only, and its message describes this exact failure ("ELK reserved room at its own spot beside the wire and the diagram then drew the label offset past it").
- evidence: read
- severity: medium
- fix: packages/diagram-elk/src/toElk.ts
- size: line
- cause: inline option set only for nonzero offset
- confidence: likely

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 1 findings, files read: 4 -->
