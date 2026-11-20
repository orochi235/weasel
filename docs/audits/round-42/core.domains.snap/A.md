## pointSnap's trail always snaps with free modifiers, so the cursor preview disagrees with the click under Ctrl or Shift
- where: packages/core/src/domains/snap/pointSnap.ts:44 (pointSnap → trail)
- scenario: pen or spiro tool (`penTrail.ts:30`, `useSpiroTool.ts:62`) with an anchor placed; hover holding Ctrl (`snap.suspend`) near another node's anchor → `trail` calls `session.at(p, FREE)`, so the rubber band and the readout marks snap to the anchor, but the click goes through `place(dep, p, mods)` with `suspend: true` and lands unsnapped where the pointer is. With Shift (`snap.constrain`) held, the preview likewise ignores the 15° step the placed point then takes. `trail` takes no `mods`, so a caller cannot pass the held roles. The preview should resolve under the same mods the click will use.
- evidence: read
- severity: medium

## SnapCollect.include is documented and read by pathSnapSource, but no session ever sets it
- where: packages/core/src/domains/snap/types.ts:97 (SnapCollect.include); packages/core/src/domains/snap/session2d.ts:103 (collectAtPress)
- scenario: a source honoring `q.include` (as `pathSnapSource.ts:35` does), or a reader of docs/snapping.md's table ("nodes that alone offer targets"), expects a way to restrict targets to some nodes. `collectAtPress` copies `gesture, ids, parent, exclude, drawnBox, origin, also, scene, frameOf` and never `include`, and neither `SnapBegin` nor `Session2dInputs` nor `SnapSession2dOptions` has the field. So `include` is always undefined: the restriction it promises cannot be asked for through any session.
- evidence: read (grep for `include:` across packages finds no setter)
- severity: low

## createSnapSession2d cannot express SnapBegin's `along`, per-gesture `sources` or `omit`
- where: packages/core/src/domains/snap/sceneSession2d.ts:137 (createSnapSession2d)
- scenario: the function is documented as "the session a canvas's `snap` dep begins", but its request copies only the listed options; a host without `<SceneCanvas>` running a move held to one direction (`along`, honored by `inputFlat` line 14) has no option to pass it, so its δ is free in the plane where a canvas move would be held to the line. Likewise `omit` (the canvas dep filters by it, `canvas/deps/snap.ts:82`) has no equivalent.
- evidence: read
- severity: low

## The test sessionDep ignores a request's `sources` and `omit`, unlike the canvas dep it stands in for
- where: packages/core/src/domains/snap/testing/sessionDep.ts:50 (sessionDep)
- scenario: an action that passes `begin({ ..., sources: [extra], omit: ['path-snap'] })` is tested through `sessionDep(scene, sources)`; `begin` hands `createSceneSession2d` only the fixed `sources`, so the gesture's own sources are never asked and `omit` drops nothing. The canvas dep (`canvas/deps/snap.ts:82-87`) appends `req.sources` and filters by `req.omit`, so a test passes against behavior the canvas does not have (or fails for a gesture source that works in the canvas).
- evidence: read
- severity: low

## The debug snap overlay places a segment or bounded-face candidate on its unbounded flat
- where: packages/core/src/domains/snap/debugCandidates.ts:23 (recordSnapCandidates)
- scenario: a source yields a segment (`locus.span: [[0, 1]]`, one dir); with the probe beyond the segment's end, `nearestOnFlat(c.locus, p)` ignores `span` and records a point on the line's extension, past the segment, though the resolver measures the candidate against the clamped segment. `?debug=snap` then draws the candidate somewhere it could never put the probe.
- evidence: read
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

<!-- done: 5 findings, files read: 24 -->
