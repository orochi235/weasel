I couldn't write `.skulkr/out/findings.md` because permission was denied, so the full document is below.

# Audit round 57: ui.components.Badge.bases

## octant-bspline reads s = 0 and s = 1 from a phantom control point, so the outline dents at its cardinal and diagonal vertices
- where: packages/ui/src/components/Badge/bases/OctantBSpline.tsx:129-130 (evalNurbsAtS)
- scenario: the knot vector is clamped, so u = 0 and u = 1 land on the first and last *extended* controls. Those are the phantoms (`s = -anchors[2].s, r = anchors[2].r` and `s = 2 - anchors[N-3].s, r = anchors[N-3].r`), not anchors[0] / anchors[N-1]. `evalNurbsAtS` sends `s <= 0` and `s >= 1` straight to those u values, so it returns the phantom's radius, not the curve's value where S(u) actually crosses 0 or 1. With the default anchors (end radii 48 and 46), r(0) = 32 and r(1) = 32, while r(0.1) ≈ 39.25 and r(0.77) ≈ 38.90. Those figures are the expected values in octantSplines.test.ts `BEFORE.defaults.bspline`, so the test pins the jump in place. `splineVertices` lands on exactly s = 0 at vertex 0 (θ = 0), and on exactly s = 1 wherever |sin 2θ| evaluates to 1 (θ = π/4, 3π/4, … with the default 192 samples and rotation 0). Those vertices get pulled in to the phantom radius, which shows as a dent at the right cardinal point and at the diagonals of every default `octant-bspline` badge. Quadrant mode dents vertex 0 the same way. The fix is to drop the two early returns, since the bisection already handles the ends. For the same reason, the docstring's claim that the curve passes "through the two ends only" is false.
- evidence: read (the test's expected values show s=0 → 32 and s=1 → 32 for anchors whose end radii are 48 and 46)
- severity: high

## powerline gives two edge segments the bottom normal; with a puzzle cap they make up about a third of each side edge
- where: packages/ui/src/components/Badge/bases/Powerline.tsx:49,77-93 (build / perimeterAt)
- scenario: `perimeterAt` gives each segment the normal of its *end* point. The segment from `right[len-2]` to `rBot` ends on `rBot`, which is tagged `(0, 1)`, so the last piece of the right edge gets the bottom normal. The closing segment from `left[1]` back to `lTop` is hard-coded to `(0, 1)` as well, though it is the top piece of the left edge and should be `(-1, 0)`. For a profile edge each piece is 1/64 of the height. For a `puzzle` cap, though, `puzzleEdge` starts and ends with a straight run of length `yc - yf`. With depth 6 at a 20px row that is 7 of the edge's 20px, all reported as pointing down. `composeOutline`'s bloat and offset effects (Bites, Scallops, Puffs, Bevel) then push those parts of the side edges downward, not outward. Separately, every right-edge or left-edge point is tagged `(±1, 0)` whatever the profile's slope, so the top and bottom faces of a puzzle knob, and chevron or slant flanks, also get sideways normals.
- evidence: read
- severity: medium

## rounded-rect at `erosion: 0, pinch: 1` returns a zero-length normal along both end edges
- where: packages/ui/src/components/Badge/bases/RoundedRect.tsx:168-181 (pinchedSampler / pinchedAt)
- scenario: `pinch = 1 · (1 - 0) = 1`. `pinchY(100, y)` and `pinchY(0, y)` both give 50, so the whole right edge and the whole left edge collapse to the points (100, 50) and (0, 50). For any s on those edges farther than `eps = totalCss/480` from a corner, the points `a` and `b` coincide. The tangent is then zero, `tl` falls back to 1, and the normal returned is `(0, 0)`, which breaks the "unit length" contract. Bloat and the offset effects do nothing over that stretch of perimeter, which can be a sizable share for a tall badge, and anything that divides by the normal or reads its direction gets 0.
- evidence: read
- severity: medium

## a ribbon with both ends `inward` crosses itself when the badge is narrower than twice `taperWidth`
- where: packages/ui/src/components/Badge/bases/Ribbon.tsx:58-66 (build)
- scenario: `taperVb` is not held to half the box, unlike ChamferedRect's chamfer (held since 74c6bc891e). With `left: 'inward', right: 'inward'` the insets are `round(0.8·t)` per side, so a short or empty label with the default taper of 8 gives a box of about 12–16px and `taperVb` > 50. The left notch tip `(taperVb, 50)` then lies right of the right notch tip `(100 - taperVb, 50)`. The edges `(100,0)→(100-taperVb,50)` and `(taperVb,50)→(0,0)` cross, and the body draws as a bowtie. `outward` ends cross the same way: the top edge inverts once `taperVb` > 50. The taper should be held to `boxW / 2`.
- evidence: read
- severity: low

## the quatrefoil's smoothMax lifts the spike and lobe tips past `spikeR` / `lobeR`, so the spike leaves the viewBox
- where: packages/ui/src/components/Badge/bases/Quatrefoil.tsx:64-67,104 (smoothMax / quatrefoilRadius)
- scenario: `smoothMax(a, b, g) = (a + b + hypot(a - b, g)) / 2` is greater than `max(a, b)` by `(hypot(d, g) - d) / 2` for every `g > 0`, not only near the valley as the comment says. With the defaults (spikeR 50, valleyR 25, valleySmooth 3), r(0) = 50.09, so the cardinal tips poke past the 0..100 viewBox that `spikeR` is clamped to 50 to stay inside. With `valleySmooth: 20`, r(0) = 53.5.
- evidence: read (computed by hand from the formula)
- severity: low

## `resolveEdge` looks up a cap name on a plain object literal, so prototype names like `'toString'` resolve to Object.prototype functions
- where: packages/ui/src/components/Badge/bases/edgeProfiles.ts:123 (resolveEdge)
- scenario: `PATHS[cap] ?? PATHS.flat` falls back to `flat` only for `undefined`. A cap that arrives as an unchecked string (`powerlineProps.ts` passes `seg.leftEdge` through from serialized or lab state) such as `'toString'` or `'constructor'` returns an Object.prototype function. `Powerline.build` then calls it as an `EdgePath`, `left[0]` is `undefined`, and `lTop.x` throws. An unknown name like `'zigzag'` falls back to flat as intended. The lookup should use `Object.hasOwn` or a null-prototype table.
- evidence: read
- severity: low

## `PerimeterPoint`'s normal is documented as unit length in viewBox terms, but every base returns it unit length in CSS px, as the effects expect
- where: packages/ui/src/components/Badge/bases/types.ts:9 (PerimeterPoint.nx/ny)
- scenario: `polygonSampler` and `RoundedRect` build the normal from CSS-space edge vectors (`(b - a) / sx`), and `composeOutline` and the effects multiply it by CSS px and then by `sx`/`sy`. A base written to the documented contract would produce skewed bloat and offsets in any non-square badge.
- evidence: read
- severity: low

## the puzzle base's `tabSize` doc gives a range of 0..50, but the code clamps it to 2..40
- where: packages/ui/src/components/Badge/bases/Puzzle.tsx:14,89 (BadgePuzzleBaseParams.tabSize / build)
- scenario: `tabSize: 45` or `tabSize: 1`, both inside the documented range, draw as 40 and 2 with no indication.
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