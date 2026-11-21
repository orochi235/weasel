# Audit round 65 — diagram-formats.drawXml

## A pool's `members` are written inside the pool cell, though the diagram ignores them, and they take a node away from its lane
- where: packages/diagram-formats/src/drawXml/writePage.ts:37 (parentsOf)
- scenario: a pool `{ role: 'pool', members: ['n'], lanes: [{ id: 'L', members: ['n'] }] }`. The diagram (`packages/diagram/src/dataContainers.ts:98-99`) claims only a container's `members` and a pool's lanes' members, so it draws `n` in lane `L`. `parentsOf` runs `for (const m of c.members ?? []) claim(m, c.id)` for every role, so the pool claims `n` first, the lane's claim fails, and `n` is written as a direct child of the pool cell. Reading the file back, `n`'s `regionOf` is the pool, and `readRegion` gives a pool no members, so `n` comes back in no lane at all. A node named only in a pool's `members` (drawn free by the diagram) is likewise written nested in the pool. The claim loop should skip `members` for a pool, as the diagram does.
- evidence: read
- severity: medium

## A cluster naming a container is written with the container nested in its group, which the diagram ignores and the reader then drops
- where: packages/diagram-formats/src/drawXml/writePage.ts:56 (parentsOf), packages/diagram-formats/src/drawXml/readPage.ts:85 (groupMembers)
- scenario: `DataCluster.members` holds node and cluster ids, and the diagram ignores any other id. `parentsOf` checks a cluster member only against `known`, which is all the vertex ids on the page, containers and lanes included. So a cluster `{ members: ['c'] }`, where `c` is a container, reparents the container under the group cell, and the group's box is unioned around it. That gives a group the diagram never drew. On read, `groupMembers` keeps only shapes and kept groups, so the group is dropped with "Groups holding no shape were dropped". The writer and the diagram answer "which ids can a cluster hold" in two different ways.
- evidence: read
- severity: low

## A row's `tracking`, and a numeric `weight` that is not bold, are dropped on write with no warning, and rows that differ only in them do not warn
- where: packages/diagram-formats/src/drawXml/writeStyle.ts:52 (fontOf), :56 (fontParts)
- scenario: a node with a row whose style is `{ tracking: 0.1 }`, or `{ weight: 300 }`. `fontOf` writes only fontSize, fontFamily and the bold or italic bits, so both are lost and nothing warns. Other things the format cannot hold (marks, own ports, trims) do warn. `fontParts` compares rows by `writeStyle(fontOf(...))`, so two rows that differ only in tracking or light weight are not flagged as "styled apart" either.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/drawXml/cellText.ts
packages/diagram-formats/src/drawXml/cells.ts
packages/diagram-formats/src/drawXml/format.ts
packages/diagram-formats/src/drawXml/mapping.ts
packages/diagram-formats/src/drawXml/pageCells.ts
packages/diagram-formats/src/drawXml/read.ts
packages/diagram-formats/src/drawXml/readPage.ts
packages/diagram-formats/src/drawXml/readStyle.ts
packages/diagram-formats/src/drawXml/style.ts
packages/diagram-formats/src/drawXml/write.ts
packages/diagram-formats/src/drawXml/writeEdge.ts
packages/diagram-formats/src/drawXml/writePage.ts
packages/diagram-formats/src/drawXml/writeStyle.ts
packages/diagram-formats/src/drawXml/writeXml.ts

<!-- done: 3 findings, files read: 14 -->
