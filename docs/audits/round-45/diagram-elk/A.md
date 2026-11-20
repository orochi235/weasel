I couldn't write `.skulk/out/findings.md` because the write was denied, so the whole document is below.

# diagram-elk findings (round 45)

The brief names commit 04c3a6536306f9e757e77a6ab15759ff43b02241, but this clone doesn't have it (`git cat-file` reports a bad object). I read the files at HEAD 782733b19c instead, where the listed files have no uncommitted changes.

## Edges at an unheld pin keep ELK's route, label point, and ports, which point to where ELK put the pin, not where it stays
- where: packages/diagram-elk/src/elkPlan.ts:139-149 (planFrom), and endPorts at :174
- scenario: two nodes A and B are pinned, and ELK places B away from its pinned spot, so B ends up in `unheld`. `movesFrom` leaves B where it is. But planFrom still sets `waypoints`, `labels`, and `ports` for every edge touching B from ELK's route, which ends at the spot ELK gave B, not at B. `endPorts` also picks B's port by face using that spot. The wire bends out to empty space, doubles back to B, and joins it on a port chosen for the wrong side. layered handles this case differently: `layeredPlan` skips every chain with a displaced pinned end (packages/diagram/src/layered/plan.ts:164), so the edge runs straight. The ELK path should drop routes, labels, and inferred ports for any edge with an end in `unheld`.
- evidence: read
- severity: medium

## A reordering cluster's `ordered` member order never reaches ELK
- where: packages/diagram-elk/src/toElk.ts:102-106 (boxOf), :125 (root children)
- scenario: a cluster with `reorder` set reaches the graph with `GraphCluster.ordered` (packages/diagram/src/graph.ts:223, fromData.ts:285), and layered keeps that order across every rank (layered/order.ts:124-132). toElk always lists a cluster's nested clusters first, then its leaves in graph order. It never reads `ordered` and sets no model-order option such as `elk.layered.crossingMinimization.forceNodeModelOrder`, so ELK can put the members in any order. The option is silently dropped on this path. The README's "What goes in" table doesn't mention it: it lists only `order`, `chain`, and `chainSide` as not taken.
- evidence: read
- severity: low

## An edge label's `offset` is dropped, so ELK leaves room for the label in the wrong place
- where: packages/diagram-elk/src/toElk.ts:118 (toElk, edge labels)
- scenario: take a label with `EdgeLabelRoom.offset = 40`, meaning it is drawn 40 units left of the direction of travel. toElk gives ELK only the label's `width` and `height`, so ELK leaves room at its own default spot beside the wire. planFrom (elkPlan.ts:146) projects the center of that room onto the route as `near`. The diagram then draws the label 40 units from `near`, on the side `offset` names. That is outside the room ELK reserved and can overlap a neighboring node. layered includes `offset` when it sizes the label's slot (packages/diagram/src/layered/expand.ts:81-88).
- evidence: read
- severity: low

## A failed import of elkjs's bundled build is cached, so every later layout fails too
- where: packages/diagram-elk/src/elkPlan.ts:85-91 (defaultElk)
- scenario: in a browser, the first layout's dynamic `import('elkjs/lib/elk.bundled.js')` rejects, for example because a chunk fails to load while offline or during a deploy. `bundled ??=` keeps the rejected promise. Every later `elkPlan` call without `opts.elk` rejects with the same error until the page reloads, even after the network is back. The promise should be cleared when it rejects, so the next call tries again.
- evidence: read
- severity: low

## The README documents an `ElkPlan.groups` field, but the field is `clusters`
- where: packages/diagram-elk/src/elkPlan.ts:51 (ElkPlan.clusters); the stale text is in the "What comes back" table of packages/diagram-elk/README.md
- scenario: a consumer following the README reads `plan.groups` and gets `undefined` (or a type error in TypeScript). Commit 42b1c31698 renamed the field to `clusters` but left the README's `groups` row unchanged, along with its "A group" row and "nested groups" wording.
- evidence: read
- severity: low

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 5 findings, files read: 4 -->