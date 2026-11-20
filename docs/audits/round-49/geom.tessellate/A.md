I couldn't write `.skulk/out/findings.md` because the permission was declined, so the full document is below. One thing to check: the checkout's HEAD is `d057251407`, not the frozen commit `2f3b11aab7` the brief names, and the line numbers are from that tree.

# Findings: geom.tessellate (round 49)

## Nonzero fills whose outlines cross only at a vertex skip crossing resolution, so overlaps are drawn twice or filled where winding is 0
- where: packages/geom/src/tessellate/tessellate.ts:174 (tessellatePolygon), packages/geom/src/tessellate/crossings.ts:98 (anyCrossing), packages/geom/src/tessellate/sweep.ts:67 (crossingParams)
- scenario: the nonzero path only calls `resolveCrossings` if `anyCrossing` finds a crossing. `crossingParams` only counts a crossing that lies strictly inside both segments (`s, u ∈ (1e-9, 1−1e-9)`), and it returns null for parallel edges. So a crossing that falls on an endpoint or a collinear stretch is never seen.
  - Example: A = `M0 0 L10 0 L10 10 L0 10 Z` and B = `M5 0 L15 0 L15 10 L5 10 Z`, two same-height rectangles.
  - `anyCrossing` returns false.
  - `nestRings` puts B outside A, because (15,0) is outside A's box.
  - Both rings get |winding| = 1, so each is triangulated on its own. The overlap [5,10]×[0,10] is drawn twice, which shows darker under a translucent fill.
  - If B is wound the other way (or B = `M5 0 L10 5 L15 −5 Z`), the overlap's true winding is 0, so it should be empty, but it is filled.
  - `resolve`'s `cutAtContacts` already handles these touches. The even-odd path tests for contact with the tolerant `anyContact`, so the two fill rules decide "do the outlines meet" in two different ways.
- evidence: read
- severity: high

## nestRings rejects a ring on its container's outline when a vertex rounds just outside the container's box
- where: packages/geom/src/tessellate/nesting.ts:50 (contains)
- scenario: the box test has no tolerance and runs before the `eps`-tolerant `onOutline` check.
  - Example: `r` shares `o`'s left edge at x = 0, and one of `r`'s vertices comes out of flattening or a resolve at x = −1e-15.
  - That vertex is within `eps` of `o`'s outline, but it fails the box test, so `r` becomes a top-level ring.
  - If `r` is wound the same way as `o`, it gets winding 1 instead of 2, so the rebuild never runs and the shared region is drawn twice.
  - If `r` is wound the other way, it fills instead of cutting a hole.
  - The box test should allow `eps`, as `onOutline` does.
- evidence: read
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

<!-- done: 2 findings, files read: 11 -->