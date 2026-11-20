# Audit round 47 — editing.actions.insert (reviewer findings)

## A from-center polygon or star drawn by a level (or plumb) drag previews a full shape and commits nothing
- where: packages/editing/src/actions/insert/shape.ts:120 (isCommittableExtent), with packages/editing/src/actions/insert/commit.ts:56 (commitInsert) and packages/editing/src/actions/insert/extras.ts:42-50, 63-67 (buildExtras)
- scenario: polygon (or star) tool, Alt held (or `originMode: 'center'`), no `minSize`; press at (100,100), release at (160,100) — common with grid snap or any snapped end that lands on the start's row. `buildExtras` sets `center` (100,100) and `radius`/`outerRadius` = hypot(60,0) = 60, and `insertPreviewExtent` (which the overlay and `editing/src/deps/insert.ts` `nodeFor` both use) draws/mints a 60-radius polygon from them, ignoring the box. But `insertRectFor(..., 'center')` gives bounds `{width: 120, height: 0}`, so `isCommittableExtent` (`width !== 0 && height !== 0`) returns false and the release inserts nothing, after the preview showed a complete hexagon. In center mode a radial kind's extent is its radius, not the AABB; the guard should test `radius > 0` (or the extent `insertPreviewExtent` computes) for polygon/star, as it already special-cases line.
- evidence: read
- severity: medium

## The insert's container is decided at the raw press point for snap scope and copies, but the dep parents the node at `ends.start`, which can be a different point
- where: packages/editing/src/actions/insert/session.ts:85 (beginInsert), packages/editing/src/actions/insert/action.ts:65 (start, `copies`), packages/editing/src/actions/insert/shape.ts:29-31,97-98 (resolveEndpoints / insertShape), packages/editing/src/actions/insert/frame.ts:52-60 (carryStart), packages/editing/src/actions/insert/placeAction.ts:53-65 (run)
- scenario: `insertParent` picks the page under the point it is given. `beginInsert` asks at `ctx.world` (the raw press) and uses the answer as the snap sessions' `parent` (grid scope) and for the preview `copies`; the `insert` dep's `site(ends?.start ?? …)` (`editing/src/deps/insert.ts:174`) asks again at `ends.start`. `ends.start` is not the press when (a) a line is drawn from-center: `resolveEndpoints` mirrors the start to the far side of the pointer, so a center line pressed near a page's edge parents to the neighboring page or the pasteboard at the mirrored end; (b) Space-reposition (`carryStart`) carries the start onto another page; (c) the start snapped across a page edge. The preview's copies and the snap's grid scope then belong to one container while the node lands in another. `placeAction` does the same: `parent` from the raw click `{x,y}`, the node parented at the snapped `at`. One point should decide the parent for snap, copies and commit.
- evidence: read
- severity: medium

## A behavior-shaped start is not the point the line's Shift constraint turns about, and Space-reposition throws the behavior's shaping away
- where: packages/editing/src/actions/insert/frame.ts:24-43 (shapeEndpoints), packages/editing/src/actions/insert/frame.ts:52-60 (carryStart), packages/editing/src/actions/insert/session.ts:111 (beginInsert)
- scenario: (a) a bound `InsertBehavior` whose `onMove` returns `r.start` (and the snap does not hold the start) moves the drawn start each frame, but `session.snap.end(...)` already ran about the anchor set once at press (`snap.anchor(startPoint)`), and `anchor` is never called with the behavior's start. With Shift on a line, the end sits on a 15° ray through the old anchor, so the committed line from the behavior's start is off-angle. (b) a behavior's `onStart` shapes `origin` (snap not holding it); the first `carryStart` calls `snap.carry`, which moves from the snap's own unshaped raw press (`raw` in `spanSnap.ts`) and overwrites `gestureCtx.origin` with that, so after holding Space the start jumps by the behavior's original offset.
- evidence: read
- severity: low

## Click-to-place leaves the selection cleared, and its snap session open, when the dep's commit throws
- where: packages/editing/src/actions/insert/placeAction.ts:51-71 (run)
- scenario: `run` clears the selection (`deps.operands?.set([])`), opens `deps.snap.begin(...)`, and only restores the selection when `dep.commit` returns null. A consumer `insertNodeFactories` entry that throws (or a throwing `snap.at`) leaves the prior selection gone with nothing inserted, and (for `snap.at`) the session's marks drawn, since `snap?.end()` is not in a `finally`. The drag path answers the same case the other way: `action.ts:104-108` restores the selection in a `finally` and closes the snap in an outer `finally`.
- evidence: read
- severity: low

## The polygon/star param defaults are written out twice instead of read from `SHAPE_DEFAULTS`
- where: packages/editing/src/actions/insert/extras.ts:27, 54-55 (buildExtras)
- scenario: `buildExtras` hard-codes `sides ?? 6`, `points ?? 5`, `innerRadiusRatio ?? 0.5`, while `params.ts` (the last-operation form), `insertPreviewExtent` and the dep read `SHAPE_DEFAULTS` from core. They agree today (6/5/0.5); a change to `SHAPE_DEFAULTS` would leave a drag-drawn polygon with a different side count than the panel shows for the same insert. One decision answered in two places.
- evidence: read
- severity: low

## Files read
packages/editing/src/actions/insert/action.ts
packages/editing/src/actions/insert/commit.ts
packages/editing/src/actions/insert/extras.ts
packages/editing/src/actions/insert/frame.ts
packages/editing/src/actions/insert/geometry.ts
packages/editing/src/actions/insert/lands.ts
packages/editing/src/actions/insert/live.ts
packages/editing/src/actions/insert/params.ts
packages/editing/src/actions/insert/placeAction.ts
packages/editing/src/actions/insert/repositionAction.ts
packages/editing/src/actions/insert/rotateAction.ts
packages/editing/src/actions/insert/session.ts
packages/editing/src/actions/insert/shape.ts
packages/editing/src/actions/insert/style.ts

<!-- done: 5 findings, files read: 14 -->
