# Audit round 45 — diagram-elk findings

## Routes, waypoints and ports for edges touching an unheld pinned node follow ELK's position, not the node's
- where: packages/diagram-elk/src/elkPlan.ts:139 (planFrom)
- scenario: two nodes pinned (`pin: ['a','b']`), ELK places `b` somewhere other than its current bounds. `b` stays put (`movesFrom` skips pinned nodes) and lands in `unheld`, but every route into `b` is `elkRoute.map(shift)`, ending where ELK put `b`. The waypoints and label point handed to `applyLayout` therefore lead to empty space, and the drawn wire bends toward a spot away from `b` before jumping to it. `endPorts` also measures faces against ELK's box (`shift(at)`), not `b`'s real bounds, so it can pick the wrong port. An edge to an unheld node should drop its waypoints (or be rerouted), or the docs should say these routes are invalid.
- evidence: read
- severity: medium

## A failed load of the bundled ELK is cached, so every later layout rejects
- where: packages/diagram-elk/src/elkPlan.ts:89 (defaultElk)
- scenario: the first `elkPlan` call with no `opts.elk` runs `import('elkjs/lib/elk.bundled.js')`. In a browser, a transient chunk-load failure (network drop, a deploy that swapped hashed chunks) rejects that promise. `bundled ??=` keeps the rejected promise, so every later `elkPlan`/`elkPlanner` call rejects with the same error for the life of the page, even after the network recovers. It should clear `bundled` when the promise rejects.
- evidence: read
- severity: low

## A cluster sharing an id with a node gives both the same ELK id
- where: packages/diagram-elk/src/toElk.ts:78 (toElk)
- scenario: a caller passes `elkPlan` a `Graph` with node `x` and a cluster `x`. Nodes and clusters write to one `elkIdOf` map, so the cluster's `g0` overwrites the node's `n0`. `leafOf(n, elkIdOf.get(n.id))` then gives the node the id `g0`, so the ELK graph has two nodes with id `g0`. ELK then throws or merges them, and `index.nodes` has no entry for `g0`, so `fromElk` never places the node. Edges to `x` all attach to whichever one ELK resolves. The module comment promises that no caller-named id can collide. Node and cluster ids need separate maps, or the collision needs to be rejected.
- evidence: read
- severity: low

## Files read
packages/diagram-elk/src/elkPlan.ts
packages/diagram-elk/src/fromElk.ts
packages/diagram-elk/src/index.ts
packages/diagram-elk/src/toElk.ts

<!-- done: 3 findings, files read: 4 -->
