I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole document is below. The brief's commit `deaf03bd…` doesn't exist in this repo, so I reviewed the working tree as I found it. My temporary script files were denied too, so none of these was run; the octant-spline blow-up was worked out by hand from the solver.

# Audit round 60 — ui.components.Badge.bases

## octant-spline / octant-bspline `samples` has no upper bound, and `samples: NaN` throws
- where: packages/ui/src/components/Badge/bases/OctantSpline.tsx:192 (splineVertices)
- scenario: `baseParams={{ samples: Infinity }}` (or 1e9) makes `N = Math.max(48, Math.floor(samples))` infinite. The `for (i < N)` loop then pushes vertices until the tab hangs or runs out of memory. `samples: NaN` makes `N` NaN, so no vertices are made and `polygonSampler` throws on `verts[0][0]`. Quatrefoil handles the same param with `repeatCount(samples, 24, MAX_SAMPLES)` so that a huge or infinite `samples` cannot hang a render. Both spline bases (octant-bspline shares `splineVertices`) still use it unclamped.
- evidence: read
- severity: high

## A spline base given `count: NaN` or an explicit `count: undefined` throws
- where: packages/ui/src/components/Badge/bases/OctantSpline.tsx:66-80 (extractAnchorPairs)
- scenario: with `{ count: NaN }`, or `{ count: undefined }` (the spread keeps it, and `Math.floor(undefined)` is NaN), `count` comes out NaN. The loop then makes no anchors, and `pairs[0].s = 0` throws a TypeError, which takes down the badge's render. Both spline bases go through this function. NaN should read as the default (as round 57 ruled for shape params) or as the least count.
- evidence: read
- severity: high

## octant-spline breaks when two anchors share an `s`, which its defaults produce for any `count` over 5
- where: packages/ui/src/components/Badge/bases/OctantSpline.tsx:96 (solveCubicSpline), :160 (evalCompiled), defaults :47-48
- scenario: take `{ count: 6 }` with no `s5` given.
  - `s5` defaults to 1, so after sorting the anchors are s = 0, .25, .5, .75, 1 (r 46) and 1 (r 42).
  - `h[4]` is floored to 1e-9, which puts right-hand sides of about 4e9 into the system. `M[4]` comes out around −7e10.
  - The [.75, 1] segment's term `liftB*M[4]` is then on the order of 1e8, so the outline flies off the badge.
  - Separately, the curve tends to 46 as s → 1⁻, but `evalCompiled` returns 42 at s ≥ 1. That is a jump at every diagonal.
  - Any two anchors a caller puts at the same `s` do the same.
  
  Anchors that share an `s` need merging before the solve, or the defaults for `s5`–`s11` need spacing out.
- evidence: read (worked out by hand, not run)
- severity: medium

## octant-bspline in `quadrant` mode steps at every cardinal direction
- where: packages/ui/src/components/Badge/bases/OctantBSpline.tsx:40-47 (buildExtendedControls); OctantSpline.tsx:81-84 and :200-202
- scenario: `mode: 'quadrant'` closes the curve only by setting the last anchor's r to the first's. That works for the interpolating spline, but the NURBS approximates its anchors:
  - At s=0 the curve is a blend of r0, r1, r2; at s=1 it is a blend of r_n, r_{n−1}, r_{n−2}.
  - With the defaults these differ. The test's values are 40.70 at s=0 and 42.76 at s=1 before the forcing, which raises the latter.
  - `splineVertices` wraps s from about 1 back to 0 at each cardinal, so the outline gets a radial step of several viewBox units there.
- evidence: read
- severity: medium

## Bases merge params with a plain spread, so an explicit `undefined` replaces the default
- where: the `build` of ChamferedRect.tsx:14, RoundedRect.tsx:192, Powerline.tsx:28, Puzzle.tsx:88, Ribbon.tsx:54/70, Quatrefoil.tsx:88/115, OctantSpline.tsx:65/214, OctantBSpline.tsx:151
- scenario: `{ ...DEFAULTS, ...params }` keeps an `undefined` value. So does `resolveCompose`'s spread of the same kind. Effects:
  - `chamfer: undefined`: every vertex is NaN.
  - rounded-rect `erosion`, `eccentricity` or `pinch: undefined`: the corners or path are NaN.
  - powerline `depth: undefined`: the cap points are NaN, while its own `insets` falls back with `??`, so build and insets disagree.
  - ribbon `left: undefined`: `sidePoints` returns undefined and `l.top` throws.
  - puzzle `top: undefined`: draws a socket instead of the default tab.
  
  Shape params already use `withDefaults`, which skips `undefined`.
- evidence: read
- severity: medium

## A NaN base param draws NaN geometry, but a NaN shape param reads as its default
- where: RoundedRect.tsx:58, :195-199; ChamferedRect.tsx:17; Ribbon.tsx:55; Quatrefoil.tsx:89-101; OctantSpline.tsx:73-75, :191
- scenario:
  - `eccentricity: NaN` makes `rx`/`ry` NaN.
  - `pinch: NaN` passes `!== 0` and builds an all-NaN pinched sampler.
  - A NaN `chamfer`, `taperWidth`, quatrefoil radius or curvature, anchor `r`/`s`, or `rotation` does the same. A NaN `s` also gives `sort` an inconsistent comparator.
  
  `radius: NaN` is already treated as unset one line above, and round 57 ruled that NaN in a shape param reads as the default (`clampParam`). The bases do the opposite.
- evidence: read
- severity: low

## A puzzle base's sockets cross each other within the allowed `tabSize`
- where: packages/ui/src/components/Badge/bases/Puzzle.tsx:89, :55-80
- scenario: a socket reaches 1.62·r into the body. With the default `left: 'in', right: 'in'`, any `tabSize` above about 30.9 makes the two sockets overlap past the center. A `top`/`right` pair of sockets meets sooner. The clamp allows up to 40. The polygon then crosses itself: the fill goes wrong, `perimeterAt` walks a crossing outline, and `inscribedRect`'s assumption that the outline holds the center fails.
- evidence: read
- severity: low

## A pinched rounded-rect's `perimeterAt` and `totalCss` still use the unpinched arc length
- where: packages/ui/src/components/Badge/bases/RoundedRect.tsx:154-187 (pinchedSampler)
- scenario: `{ erosion: 0, pinch: 1 }` on a 200×20 badge collapses both end edges to points. `pinchedAt` still maps 2×20 px of `s` onto those points, and `totalCss` stays 440, which breaks `BaseSampler`'s CSS-arc-length contract. Effects spaced by length bunch up at the ends. Also, the 240 evenly spaced body-path samples miss the square corners and cut them by up to about 1.8 px, while `perimeterAt` returns the true corner.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/bases/ChamferedRect.tsx
packages/ui/src/components/Badge/bases/OctantBSpline.tsx
packages/ui/src/components/Badge/bases/OctantSpline.tsx
packages/ui/src/components/Badge/bases/Polygon.tsx
packages/ui/src/components/Badge/bases/Powerline.tsx
packages/ui/src/components/Badge/bases/Puzzle.tsx
packages/ui/src/components/Badge/bases/Quatrefoil.tsx
packages/ui/src/components/Badge/bases/Ribbon.tsx
packages/ui/src/components/Badge/bases/RoundedRect.tsx
packages/ui/src/components/Badge/bases/edgeProfiles.ts
packages/ui/src/components/Badge/bases/index.ts
packages/ui/src/components/Badge/bases/inscribedRect.ts
packages/ui/src/components/Badge/bases/polygonSampler.ts
packages/ui/src/components/Badge/bases/types.ts

<!-- done: 8 findings, files read: 14 -->