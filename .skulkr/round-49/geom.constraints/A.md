# Audit round 49 — geom.constraints findings

## An `onPath` constraint survives a subpath reversal with its segment still named in the old direction, so the solve holds the anchor on the wrong curve
- where: packages/geom/src/constraints/pathConstraints.ts:88 (anchorsBefore), packages/geom/src/constraints/pathsEdit.ts:149 (constrainPathsEdit, `joined`)
- scenario: a path whose anchor 3 carries `{ kind: 'onPath', anchor: 3, segment: [0, 1] }` is edited so its subpath runs the other way (`editAnchorSetTracked` marks those origins `reversed: true`, paths/anchorOrigins.ts:182). `anchorsBefore` ignores `reversed`, so the constraint remaps to `[a', b']` in the same order. The `joined` check calls `segmentBetween`, which accepts either order, so the constraint is kept. The path now runs `b' → a'`, and a reversal swaps each anchor's in and out handles, so `segmentCubic` (residuals.ts:47) builds the cubic from `a'`'s out handle and `b'`'s in handle. Those are the handles of the neighboring segments, not of the segment between the two anchors, so the anchor is pulled onto a curve that isn't drawn. Expected: the remapped segment is reoriented to the pair `segmentBetween` answers, or the `joined` check compares the order and swaps it.
- evidence: read
- severity: medium

## `segmentBetween` cannot answer the closing segment of a two-anchor closed subpath, and answers its opening segment instead
- where: packages/geom/src/constraints/pathConstraints.ts:129 (segmentBetween)
- scenario: a closed subpath of two curved anchors (a lens) has two segments, 0→1 and the closing 1→0 (`segmentEnds`, paths/anchors.ts:233, counts the closing segment whenever `s.length > 1`). `next` here only wraps when `n > 2`, so `segmentBetween(path, 1, 0)` finds no 1→0 and returns `[0, 1]`. `linkAnchor` (path-tools/src/constraints/linkAnchor.ts:82-84) builds `a = 1, b = 0` from a hit on the closing segment and calls `segmentBetween`, so a link made on the lens's closing curve binds the anchor to the other curve. Expected: `[1, 0]` for a closed subpath with two anchors, matching `segmentEnds`.
- evidence: read
- severity: medium

## A path's own constraint naming an anchor past that path's count silently binds an anchor of the next path in a multi-path edit
- where: packages/geom/src/constraints/pathsEdit.ts:134 (constrainPathsEdit)
- scenario: take items `[A (3 anchors), B (4 anchors)]`, where A's stored constraints include `{ kind: 'fixed', anchor: 4 }`, left behind as stale scene data by an untracked edit. Nothing in `finishLinkedEdit` (path-tools/src/constraints/constraintLinks.ts:149-162) filters these with `constraintFits`. `mapConstraintAnchors(c, a => wasStart[i] + a)` maps the constraint to global anchor 4, which is B's anchor 1. `constraintApplies` checks only the global count, so B's anchor 1 gets pinned. The constraint is then reported back on A (by `itemOf` of its first anchor) as anchor 4 again. A negative index on item 1 lands on item 0's last anchor the same way. In `constrainPathEdit`, which has one item, the same constraint is correctly reported unsatisfied. Expected: an own constraint that doesn't fit its own path's anchors is left out of the solve and reported unsatisfied, as it is in the single-path case.
- evidence: read
- severity: low

## A `length` or `equalLength` constraint whose segment starts with zero length gets no gradient, so the solve cannot open the segment
- where: packages/geom/src/constraints/residuals.ts:131 (lengthOf)
- scenario: two anchors sit on one point with `{ kind: 'length', segment: [0, 1], length: 10 }`. The residual is −10, but `lengthOf` emits no derivative when `len ≤ 1e-12`. The Jacobian row is zero, so every step is zero, λ climbs to 1e12, and the solve returns unconverged, although moving either anchor 10 units satisfies the constraint. Likewise, an `equalLength` with one zero-length segment only ever shrinks the other segment, which `collapsedBy` then flags. Expected: the residual picks a direction for a degenerate segment (any unit vector) so the solve can grow it.
- evidence: read
- severity: low

## Files read
packages/geom/src/constraints/check.ts
packages/geom/src/constraints/conflicts.ts
packages/geom/src/constraints/index.ts
packages/geom/src/constraints/pathConstraints.ts
packages/geom/src/constraints/pathsEdit.ts
packages/geom/src/constraints/points.ts
packages/geom/src/constraints/residuals.ts
packages/geom/src/constraints/solve.ts
packages/geom/src/constraints/sparse.ts
packages/geom/src/constraints/types.ts

<!-- done: 4 findings, files read: 10 -->
