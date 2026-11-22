# Audit round 68 — editing.actions.insert

## Behavior commit appends the press's selection clear after the behavior's ops, so it overrides their selection and undo does not restore the prior one
- where: packages/editing/src/actions/insert/commit.ts:49 (commitInsert)
- scenario: a selection exists at press; an `InsertBehavior` answers `onEnd` with `[insertOp, ops.setSelection({ from: [], to: [newId] })]` (select what it made). The batch becomes `[insertOp, setSelection([]→[newId]), setSelection(prior→[])]`. `createSetSelectionOp.apply` sets `to` unconditionally (core/ops/select.ts:34), so the selection ends empty instead of `[newId]`. On undo the inverses run in reverse: `setSelection(→prior)` then `setSelection(→[])`, so the selection ends empty instead of restoring `prior`. Prepending the clear (`[...selectionOps(session), ...r]`) gives the right result both ways.
- evidence: read (commit.ts:49, core/src/core/ops/select.ts:30-39)
- severity: medium

## placeAction places at the click's release point, ignoring `params.press`
- where: packages/editing/src/actions/insert/placeAction.ts:52 (placeAction.run)
- scenario: the dispatcher lays `press` under a click's params precisely so "geometry placed at a click pins here, so the drift between press and release can't move a snapped point" (routing/.../inputFacts.ts:62). placeAction reads only `params.world` (the release), so a click that drifts a few pixels between down and up places — and snaps, and picks its container — at the drifted point; near a snap target's edge the drift flips which target holds it. Other click-placed geometry reads `params?.press ?? params?.world` (path-tools scenePaths.ts:36, warpActions.ts:208). It also deletes `press` from the binding (CLICK_FIELDS) without using it.
- evidence: read
- severity: medium

## Line from-center hands the dep a box twice the line's extent
- where: packages/editing/src/actions/insert/shape.ts:87 (insertShape)
- scenario: a line drawn with Alt (mode `center`): `resolveEndpoints` mirrors the start to `s' = 2s − c`, then `insertRectFor(s', c, 'center')` builds a box centered on `s'` with half-extents `|c − s'| = 2|c − s|`, i.e. from `4s − 3c` to `c` — twice the line's length on each axis and not containing its midpoint as center. The line's `extras.a/b` are right, so the kit's own dep (which reads a/b) is unaffected, but `bounds` passed to `dep.commit`/`dep.peek` for a consumer dep, and to `insertLanding`, is wrong; the corner-mode box would be `rectBetween(s', c)`.
- evidence: read (inference for the consumer-dep effect)
- severity: low

## Behaviors' `onMove` get a `bounds` computed differently from the one previewed and committed
- where: packages/editing/src/actions/insert/frame.ts:39 (shapeEndpoints)
- scenario: a behavior bound to a tool with `minSize`, or to the line kind under Alt, receives `bounds = insertRectFor(start, current, mode)` with no `reachMinimum` and no line mirroring, while `insertShape` (preview and commit) applies both. A behavior that sizes or aligns from `bounds` (e.g. snapping the box to a grid cell) reasons about a box that is not the one drawn: a 2×2 drag under a 20×20 minimum reports a 2×2 box while a 20×20 shape is previewed. One decision answered in two places.
- evidence: read
- severity: low

## A behavior `onStart` that throws leaves the selection cleared and the start's snap session open
- where: packages/editing/src/actions/insert/session.ts:123 (beginInsert)
- scenario: beginInsert clears the selection (l.95) and opens the start's snap session (`snap.start`, l.106) before running behaviors' `onStart`. If one throws, `start` never returns a handle, so `onEnd` never runs: the prior selection is not restored and `snap.close()` is never called, leaving the start's snap marks drawn until some later gesture drops them. No try/finally guards the press path the way `onEnd` guards the release.
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
