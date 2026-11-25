# Audit round 66 — core.domains.snap (blind reviewer)

## A move's default `geometry` probe measures its reach through the camera's scale, ignoring the parallax plane
- where: packages/core/src/domains/snap/sceneSession2d.ts:46 (createSceneSession2d, default `geometryAt`)
- scenario: a move in a parallax plane (`req.plane()` with `plane.scale` ≠ 1) hands `ownGeometryAt` the camera's `view.scale` as its px→world scale, while `press` and the scene's geometry are in plane units. `collectAll` in session2d.ts:122-124 answers the same question as `camera / max(|plane.scale|)`. With plane.scale 2 the own-outline probe is found within half (or double, depending on direction) the intended 8 px, so a press just off the outline puts the `geometry` probe on the press instead of the outline. The px→plane-units conversion is decided two ways in two places.
- evidence: read
- severity: low

## A turned resize far from the origin drops the box sides it moves
- where: packages/core/src/domains/snap/resizeBox.ts:102-109 (resizeSides, `near`)
- scenario: `near` scales its tolerance by `span` (the extent) or `size` (the rate, ~1), never by the coordinates' magnitude. For a box in a container turned 90° or 180° (cos/sin ≈ 1e-16, so two corners tie on an extreme), placed near x ≈ 1e7, each corner's rate `stepX[i][axis] - c[axis]` carries rounding of ~1e-9–1e-8, above the `1e-9 * size` tolerance. The two tied corners then read as moving apart and the side is `continue`d out of `sides`, so guides/alignment sources get no side to snap for that resize. The same box near the origin keeps the side.
- evidence: read (reasoned from float magnitudes, not run)
- severity: low

## `SpanSnap.anchor` leaves `startHeld()` reporting the replaced start's hold
- where: packages/core/src/domains/snap/spanSnap.ts:89-95 (createSpanSnap, `anchor`)
- scenario: `start(p)` lands on a target (`held = true`); a caller then `anchor(q)`s a different start the snap did not place. `startOut` is cleared, but `held` stays `true`, so `startHeld()` claims a target holds a start no target put there. The in-repo insert caller only anchors a different point when the start was not held (session.ts:125-127, frame.ts:42/70), so it is masked there, but the public contract "Whether a target holds the start" is wrong after `anchor`.
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

<!-- done: 3 findings, files read: 24 -->
