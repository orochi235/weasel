# Audit round 60: ui.components.Badge.bases

## A pinched rounded-rect base reports the unpinched perimeter as `totalCss` and walks it by unpinched arc length
- where: packages/ui/src/components/Badge/bases/RoundedRect.tsx:154 (pinchedSampler), :170 (pinchedAt), :187
- scenario: `base="rounded-rect"`, `baseParams={{ erosion: 0, pinch: 1 }}` on a 100×20 badge. The sampler returns `totalCss` 240 (the rectangle's perimeter), and `perimeterAt(s)` walks the rectangle and then squeezes y, so the 20px of `s` on each end edge all land on the single point (0, 50) / (100, 50), while the real lens outline is about 204px long with no length at its tips. Effects that space things by CSS length off `totalCss` / `perimeterAt` (Puffs' `N = totalCss / bumpWidth`, Spikes' `step = totalCss / N`, Bevel) stack every bump that falls in those 40px onto the two tips and stretch the rest. `BaseSampler` documents `perimeterAt` as "at CSS arc length `s`" and `totalCss` as the perimeter's length; the pinched outline should be reparameterized by its own arc length (measured over the warped samples).
- evidence: read
- severity: medium

## Spline anchors sharing an `s` (the default for `s5`..`s11`) blow the octant-spline curve up
- where: packages/ui/src/components/Badge/bases/OctantSpline.tsx:73 (extractAnchorPairs), :96 (solveCubicSpline)
- scenario: `base="octant-spline"`, `baseParams={{ count: 7 }}`. `s5` and `s6` default to 1, so after the sort three anchors sit at s = 1 with r 46, 42, 36. `solveCubicSpline` clamps each gap to `h = 1e-9` and must interpolate a 4px then 6px drop across it, so `d[i]` is about 4e9 and the C¹ condition hands the [0.75, 1] interval an end slope in the billions: radii near the diagonal come out at around 1e8 viewBox units and the outline is a spike off the page. `evalCompiled` also returns the last anchor's 36 at exactly s = 1 but the first one's 46 just below it, a jump at every diagonal vertex. The same happens when two anchors are given (or dragged to) one `s` with different `r`. Coincident anchors should be merged, or `s` spread (as ui-lab's `withAnchorCount` does), before the solve; `OCTANT_SPLINE_DEFAULTS` puts six of them at 1.
- evidence: read (the magnitude is reasoned from the solve, not run)
- severity: medium

## octant-bspline is not flat where its curve crosses s = 0 and s = 1, so the outline kinks at every cardinal point
- where: packages/ui/src/components/Badge/bases/OctantBSpline.tsx:40 (buildExtendedControls), :49 (buildKnots), :128 (evalNurbsAtS)
- scenario: default anchors (s 0/.25/.5/.75/1, r 48/30/32/38/46, weights 1). The phantoms mirror the control polygon about s = 0, but the knot vector is clamped at u = 0 and uniform inside, so the basis is not symmetric about the point where S(u) = 0 and the mirror does not give zero slope. Worked by hand on span [1/6, 2/6] (τ = 6u − 1): N1 = (1−τ)³/4, N3 = (−3τ³+3τ²+3τ+1)/6, N4 = τ³/6; S = 0 at τ ≈ 0.0676, where r = 40.7047, matching the test's pinned `BEFORE.defaults.bspline[0]` (octantSplines.test.ts:28), and dr/dτ ≈ 1.61, ds/dτ ≈ 0.304, so dr/ds ≈ +5.3 at s = 0. In octant mode s = |sin 2θ|, so r(θ) has a V of slope ±10.6 per radian at θ = 0, π/2, π, 3π/2: about a 30° corner on a curve the header says "enforces zero slope at s=0 and s=1 so the … silhouette closes cleanly across the symmetry axes". The right end does the same mirrored, which shows in quadrant mode.
- evidence: read, and worked by hand; the hand value of r(0) reproduces the test's pinned 40.7047
- severity: medium

## octant-bspline in quadrant mode steps radially at each cardinal, since r(0) and r(1) come from different neighbors
- where: packages/ui/src/components/Badge/bases/OctantBSpline.tsx:144 (octantBSplineRadius), with OctantSpline.tsx:81 (extractAnchorPairs) and :200 (splineVertices)
- scenario: `base="octant-bspline"`, `baseParams={{ mode: 'quadrant' }}`. `extractAnchorPairs` copies the first anchor's r and w onto the last, which is enough for the interpolating spline (it passes through both), but the B-spline passes through neither: its value at s = 0 is set by r0, r1, r2 and at s = 1 by r4, r3, r2. With the defaults (r 48/30/32/38, last forced to 48), r(0) = 40.70 and r(1) ≈ 43.95 (the same basis weights mirrored: 0.5947·48 + 0.4053·38). `splineVertices` sweeps s = θQ/(π/2) linearly per quadrant, so each quadrant ends at radius 43.95 and the next starts at 40.70: a 3.25 viewBox-unit step at θ = 0, π/2, π, 3π/2, against the header's "endpoints share radius". Quadrant mode needs the controls to wrap periodically (phantoms from the far end's neighbors) instead of mirroring each end.
- evidence: read, and worked by hand from the same basis as the finding above
- severity: medium

## The spline bases' `samples` and the puzzle's `arcSamples` have no upper bound, which quatrefoil's `samples` got in round 57
- where: packages/ui/src/components/Badge/bases/OctantSpline.tsx:192 (splineVertices, shared by octant-spline and octant-bspline); packages/ui/src/components/Badge/bases/Puzzle.tsx:90 (build), :77 (edgeVertices)
- scenario: `baseParams={{ samples: Infinity }}` on `octant-spline` / `octant-bspline`: `N = Math.max(48, Math.floor(Infinity))` is `Infinity`, so the vertex loop never ends and the render hangs (a large finite value such as 1e8 runs out of memory). `samples: NaN` gives `N = NaN`, the loop runs zero times, and `polygonSampler([])` throws at `verts[0][0]`. `puzzle` with `arcSamples: Infinity` hangs the same way in `edgeVertices`, and `NaN` silently draws each tab as a straight chord. Quatrefoil answers the same question with `repeatCount(cfg.samples, 24, MAX_SAMPLES)` ("so a huge or infinite `samples` cannot hang a render"), and round 57 ruled NaN in a bounded count reads as its least; these should go through `repeatCount` too.
- evidence: read
- severity: medium

## Two `in` puzzle edges cross each other inside the allowed `tabSize` range
- where: packages/ui/src/components/Badge/bases/Puzzle.tsx:55-63 (edgeVertices), :89 (build)
- scenario: a socket's circle is centered `0.62·r` inside the edge with radius `r`, so it reaches `1.38·r` in and `r` to either side of the edge's midpoint. `tabSize` is held to 2..40. With the default `left: 'in', right: 'in'` and `tabSize: 40`, the left socket reaches x = 55.2 and the right one x = 44.8, so their arcs cross. Adjacent sockets cross sooner: `{ top: 'in', right: 'in', tabSize: 30 }` puts circle centers at (50, 18.6) and (81.4, 50), 44.4 apart with radius 30 each, and both drawn arcs pass through (80, 48.6) and (51.4, 20). The outline then self-intersects: the fill shows a hole or a doubled region depending on fill rule, `perimeterAt` walks through the badge's interior, and `fitsContent` fits insets against a figure that is not a simple loop. The clamp should depend on which edges are sockets (opposite pair: r ≤ 50/1.38 ≈ 36; adjacent pair a tighter bound), or the sockets should be shrunk to fit.
- evidence: read, intersection worked by hand
- severity: low

## An explicitly `undefined` base param replaces its default: NaN geometry, and a ribbon end throws
- where: packages/ui/src/components/Badge/bases/Ribbon.tsx:54, :24 (sidePoints), :43 (sideInsetCss); Powerline.tsx:28 vs :58; ChamferedRect.tsx:14; RoundedRect.tsx:192; OctantSpline.tsx:65,73-74; Quatrefoil.tsx:88
- scenario: each base merges `{ ...DEFAULTS, ...params }` (and `resolveCompose` merges `{ ...base.defaults, ...given }` the same way), so `baseParams={{ left: props.left }}` with `props.left` unset, which TypeScript accepts since `exactOptionalPropertyTypes` is off, carries `left: undefined` through. `Ribbon`'s `sidePoints` then falls out of its switch and returns `undefined`, and `l.top` throws a TypeError that ends the render; the same happens for any end string that is not one of the three. In `Powerline`, `depth: undefined` gives `build` a NaN outline (`profile(t, undefined)`) while `insets` reads `params?.depth ?? DEFAULTS.depth` and pads for 6px, so the two answer one param two ways. `chamfer`, `erosion`, `pinch`, `eccentricity`, a spline's `sN`/`rN` and the quatrefoil's radii all turn the outline to NaN the same way. Only `RoundedRect`'s `radius` and a spline weight's `?? 1` guard against it. Merging should skip undefined values (and an unknown ribbon end should read as its default), so every path reads a missing param as missing.
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
