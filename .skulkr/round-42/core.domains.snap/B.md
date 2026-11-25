## A move of a group never finds its own geometry: the default `geometryAt` is handed the group's id, not its subtree
- where: packages/core/src/domains/snap/sceneSession2d.ts:45-46 (createSceneSession2d, default geometryAt)
- scenario: a source answering `move` takes role `'geometry'`, and the user drags a `GroupNode` (`req.ids = ['g1']`) by pressing on a child's outline. The default `geometryAt` calls `ownGeometryAt(scene, press, ids, …)` with `ids = ['g1']`; `ownGeometryAt` keeps only index entries whose owner is in `ids`, but the scene snap index (`sceneIndex.ts:53`) indexes only `kind: 'mark'` nodes, so every entry belongs to a child and is skipped. `geometryAt` returns null, and `moveProbes` puts the `geometry` probe at the bare press point instead of on the group's outline nearest it. The group's edge then never lands on an anchor or a path the way a leaf's does. It should pass `withSubtrees(i.scene, ids)` (as the session already does for `exclude`), so a group's subject geometry is its descendants' geometry.
- evidence: read (sceneSession2d.ts:45-46, probes2d.ts:84, pathSnapSource.ts:67-75, sceneIndex.ts:52-57)
- severity: medium

## `SpanSnap.anchor` moves the start but leaves `startHeld()` reporting the old snap
- where: packages/core/src/domains/snap/spanSnap.ts:88-94 (createSpanSnap, anchor)
- scenario: a consumer of the exported `createSpanSnap` calls `start(p, mods)`, a target holds it (`held = true`), and then calls `anchor(q)` with a different point placed by something else. `anchor` replaces `start`, clears `startOut` and drops the sessions, but never resets `held`, so `startHeld()` still answers `true` for a start no target holds. A caller that gates on it, as the insert frame does (`frame.ts:30,41`: a held start overrides a behavior's start), then ignores its own start for a point that was never snapped. `anchor` should set `held = false` when it moves the start. Editing's insert session happens not to reach this case today, because it calls `anchor` only with the snapped point or after an unheld start.
- evidence: read (spanSnap.ts:68-94; editing/src/actions/insert/session.ts:109-111, frame.ts:30-41)
- severity: low

## Files read
packages/core/src/domains/snap/angle2d.ts
packages/core/src/domains/snap/debugCandidates.ts
packages/core/src/domains/snap/gather.ts
packages/core/src/domains/snap/inputSubspace.ts
packages/core/src/domains/snap/lazySession.ts
packages/core/src/domains/snap/marks.ts
packages/core/src/domains/snap/outcomeStore.ts
packages/core/src/domains/snap/pointSnap.ts
packages/core/src/domains/snap/probes2d.ts
packages/core/src/domains/snap/readoutDep.ts
packages/core/src/domains/snap/readoutDraw.ts
packages/core/src/domains/snap/readoutLayer.ts
packages/core/src/domains/snap/registry.ts
packages/core/src/domains/snap/resizeBox.ts
packages/core/src/domains/snap/roles.ts
packages/core/src/domains/snap/rotationSource.ts
packages/core/src/domains/snap/sceneReads.ts
packages/core/src/domains/snap/sceneSession2d.ts
packages/core/src/domains/snap/screen.ts
packages/core/src/domains/snap/session2d.ts
packages/core/src/domains/snap/spanSnap.ts
packages/core/src/domains/snap/stepAngles.ts
packages/core/src/domains/snap/testing/sessionDep.ts
packages/core/src/domains/snap/types.ts

<!-- done: 2 findings, files read: 24 -->
