I couldn't write `.skulk/out/findings.md` because permission to create it was denied, so the full findings document is below.

# Audit round 49 — geom.tessellate — reviewer findings

## A point cut inside a straight edge takes the nearer anchor's color instead of the blend (trim heads/tails, fill crossing nodes)
- where: packages/geom/src/tessellate/anchorParams.ts:13 (anchorParamsBetween), used by packages/geom/src/tessellate/trim.ts:43 (sampleAt); the same rule is copied at packages/geom/src/tessellate/crossings.ts:225 (anchorsAlong)
- scenario: take the open path `M 0 0 L 100 0`, with anchor 0 colored red and anchor 1 blue, and call `trimPolyline(pl, 30, 0)`.
  - The polyline's two points carry `(0,0,0)` and `(1,1,0)`. Their anchor pairs differ, so the head sample at x=30 gets `[0, 0, 0]`, which is pure red.
  - The untrimmed stroke shows a 70/30 red/blue blend at that spot. `expandAnchorColors` in packages/renderer/src/draw/vertexColors.ts colors each vertex `lerp(c[A], c[B], t)`.
  - So the trimmed ribbon runs from red at x=30 to blue at x=100, and a marker inset shifts the colors of the visible line.
  - A self-crossing fill has the same fault through `cutAtCrossings` → `anchorsAlong`. A crossing 30% along a straight edge between anchors i and i+1 gets anchor i's color, which leaves a visible color step in the fill.
  - Curves are affected too. A point between a curve's start anchor `(a,a,0)` and its first interior point `(a,b,t1)` should get `(a, b, frac·t1)`, but it snaps to one end.
  - The correct result, when the two points are consecutive anchors or one is anchor-aligned at an end of the other's run, is `(a, b, interpolated t)`.
  - The rule is defined twice, in anchorParamsBetween and anchorsAlong, so fixing one leaves the other wrong.
- evidence: read. I traced trim.ts sampleAt → anchorParamsBetween, crossings.ts cutAtCrossings → anchorsAlong, and renderer vertexColors.ts expandAnchorColors.
- severity: medium

## Nonzero fills resolve crossings with no work bound, unlike even-odd
- where: packages/geom/src/tessellate/tessellate.ts:174-180 (tessellatePolygon); packages/geom/src/tessellate/crossings.ts:42 (resolveCrossings) and :268 (windingAt)
- scenario: a filled freehand path using the default nonzero rule, with 20,000 edges that cross themselves about 20,000 times.
  - `resolveCrossings(flat)` runs `resolve` with `maxCrossings = Infinity`.
  - `boundaryPieces` probes two winding numbers per piece, and each `windingAt` loops over every edge. That is about 60,000 pieces × 2 × 20,000 edges ≈ 2.4e9 steps.
  - The comment on MAX_EVENODD_RESOLVE_WORK says 2^20 units of piece×edge work take about 10 ms. At that rate this path costs on the order of 20 s on the main thread per tessellate, and it reruns on every edit.
  - The even-odd path caps the same `resolve` at MAX_EVENODD_RESOLVE_WORK and falls back to the stencil. The nonzero path has neither the cap nor a fallback, so the same decision is answered two ways.
  - The `resolveCrossings(flat, true)` rebuild branch, for nested same-wound rings, is unbounded in the same way.
- evidence: read. The cost is inferred from the loops and the constant's stated timing; I did not run it.
- severity: medium

## nestRings rejects a ring by bounding box before checking whether the vertex lies on the outer ring's outline
- where: packages/geom/src/tessellate/nesting.ts:50 (contains)
- scenario: a nonzero path holds the square `(0,0),(10,0),(10,10),(0,10)` twice. The second copy carries a rounding difference, `(10.000000000000002, 0)`, as a contour duplicated through a transform would.
  - No edges cross, so `nestRings` runs.
  - For the second ring, vertex 0 lies on the outline and is skipped.
  - Vertex 1 is within `eps` (1e-8) of the outline, but `x > box[2]`, so `contains` returns `false` before the on-outline test runs.
  - The copy stays top-level with winding 1 and is triangulated a second time. That is the double coverage commit 49f1f5b295 fixed for exact copies: a mesh area of 200 for a region of 100, and a translucent fill that blends twice and draws darker.
  - The box test should allow for `eps`, or run after `onOutline`.
- evidence: read
- severity: low

## resolveCrossings ignores an incomplete chain, so a nonzero fill silently loses the region
- where: packages/geom/src/tessellate/crossings.ts:44 (resolveCrossings) and :304 (chainLoops)
- scenario: sometimes `chainLoops` cannot close a loop, because `sharpestLeft` finds no unused outgoing piece. That can happen after `weld` moves a node so that two pieces' keys no longer meet.
  - `chainLoops` then sets `complete = false` and drops the partial loop.
  - `resolveEvenOdd` checks `complete` and falls back to the stencil.
  - `resolveCrossings` ignores it and returns the remaining loops. tessellatePolygon then draws the nonzero fill with that face missing, rather than falling back to the unresolved `flat`.
- evidence: read
- severity: low

## flattenPolygon copies kept contours by spreading them into push, which throws on a large contour
- where: packages/geom/src/tessellate/tessellate.ts:57-60 (flattenPolygon)
- scenario: a path whose `openFill` is anything other than `'close'`, so the filtering branch runs, with a closed contour that flattens to more than about 60k points (about 120k coords). A long traced outline, or a small `flattenTolerance` on a large curve, gets there.
  - `kept.coords.push(...all.coords.slice(...))` passes every element as a separate call argument.
  - V8 then throws `RangeError: Maximum call stack size exceeded`, so `tessellate` throws instead of returning a mesh.
  - The same path with `openFill: 'close'` tessellates fine.
- evidence: read. The argument-count limit is engine behavior; I did not run it here.
- severity: low

## Files read
packages/geom/src/tessellate/anchorParams.ts
packages/geom/src/tessellate/atCurve.ts
packages/geom/src/tessellate/crossings.ts
packages/geom/src/tessellate/evenOdd.ts
packages/geom/src/tessellate/index.ts
packages/geom/src/tessellate/mesh.ts
packages/geom/src/tessellate/nesting.ts
packages/geom/src/tessellate/polyline.ts
packages/geom/src/tessellate/sweep.ts
packages/geom/src/tessellate/tessellate.ts
packages/geom/src/tessellate/trim.ts

<!-- done: 5 findings, files read: 11 -->