# Audit round 66, area core.domains.snap

## A move's default `geometry` probe search ignores the parallax plane's scale, so its reach is wrong in a plane
- where: packages/core/src/domains/snap/sceneSession2d.ts:46 (createSceneSession2d)
- scenario: a move in a parallax plane (`req.plane()` returns `{ scale: { x: 2, y: 2 } }`) with a source taking the `geometry` role. The default `geometryAt` calls `ownGeometryAt(scene, press, ids, view.scale, reachPx)`, where `press` and the scene index are in plane units but `view.scale` is camera px per camera unit. The radius it searches is `reachPx / view.scale` camera units, read as plane units: off by the plane's scale. `collectAll` in session2d.ts:122-124 answers the same question (px to the gesture's world units) by dividing by `plane.scale`. So one session converts reach two ways. With plane scale 2 the outline nearest the press is looked for within half the reach the ruling (unruled.md, 2026-10-18 "within the canvas's reach") promises; with plane scale 0.5 it is twice as far.
- evidence: read (parallax.ts `fromPlane` divides by `scale`; the geometry default never reads `i.req.plane`)
- severity: low

## `hold` does not keep an angle at `theta0` when another required angle is offered
- where: packages/core/src/domains/snap/angle2d.ts:57-66 (collectAngles)
- scenario: `SnapMods.hold` is documented as "the angle stays at `theta0`, which becomes a required target". collectAngles pushes the hold target as one required candidate among others: Shift's step angles (`mods.constrain` with `{ step }`) are also `required: true`, and so is any source angle with `required`. resolveSnap's `search` keeps the best combo that includes *any* required member (resolve.ts:236-249), which is the one nearest `theta`. With hold and constrain both held, theta0 = 0 and the pointer at 40°, the step target at 45° wins and the angle moves to 45° instead of staying at 0. A source offering a required angle does the same with hold alone, because `mods.hold` does not skip the sources (only `suspend` does). The hold target should exclude the others, or be the only required one.
- evidence: read (today path-tools' handleSnap.ts:99 passes `constrain: false` with `hold`, so the Shift case needs a different caller; the required-source case applies to any `'handle'` source)
- severity: low

## A rotate's angle step is checked one way and a point gesture's step another
- where: packages/core/src/domains/snap/angle2d.ts:57 (collectAngles), versus packages/core/src/domains/snap/inputSubspace.ts:29 (inputFlat)
- scenario: `SnapConstrain`'s doc (snapDep.ts:18-19) says a step is "finite and nonzero, or the gesture throws". inputFlat passes the step to `stepLine`, which throws on 0 or a non-finite step and accepts a negative one. collectAngles instead guards `c.step > 0` and silently drops the constraint otherwise. So `{ step: 0 }` or `{ step: NaN }` throws on a point gesture but quietly unconstrains a rotate. `{ step: -Math.PI / 12 }` steps a point gesture's line but drops Shift's steps on a rotate entirely, even though `stepAngles` handles a negative step correctly.
- evidence: read
- severity: low

## The debug overlay draws a spanned candidate off its span
- where: packages/core/src/domains/snap/debugCandidates.ts:23 (recordSnapCandidates)
- scenario: a source offers a segment, i.e. a locus with `dirs: [d]` and `span: [[0, 1]]`, and the probe sits beyond the segment's end. The dot is placed at `nearestOnFlat(c.locus, p)`, which projects onto the whole infinite line and ignores `span`. So the overlay draws the candidate at a point the resolver can never move the probe to; the resolver rejects off-span positions (`spanHolds`, resolve.ts:117-130). The point recorded should be clamped to the span.
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

<!-- done: 4 findings, files read: 24 -->
