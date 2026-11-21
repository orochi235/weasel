## Stroke widths documented as CSS px are multiplied by the viewBox scale and then drawn with non-scaling-stroke, so they come out too thick
- where: packages/ui/src/components/Badge/effects/glassStrokes.tsx:66 (GlassStrokes); packages/ui/src/components/Badge/effects/Outline.tsx:34 (Outline.Component)
- scenario: `vectorEffect="non-scaling-stroke"` measures `strokeWidth` in the host (CSS px) space, ignoring the viewBox transform, so the width should be passed in CSS px as is. Both files first multiply it by `max(100/boxW, 100/boxH)`. On a 200×24 pill that factor is 4.17, so `outline` with `width: 1` and Aqua/Metal's `bezelWidth`/`rimWidth: 1` draw at about 4.2 CSS px; on a 50×50 badge they draw at 2 px. Only a box of exactly 100 CSS px on its shorter side gets the documented width.
- evidence: read
- severity: medium

## Aqua's and Metal's gloss gradient ends at glossExtent² / 100, not at glossExtent
- where: packages/ui/src/components/Badge/effects/Aqua.tsx:87 (Aqua.Component); packages/ui/src/components/Badge/effects/Metal.tsx:91 (Metal.Component)
- scenario: the gloss `linearGradient` uses the default `gradientUnits="objectBoundingBox"`, so `y2={glossExtent%}` is a fraction of the bounding box of the rect that references it, and that rect is itself `glossExtent` tall. With the default `glossExtent: 50`, the gloss fades to 0 at y = 25 and the lower half of the rect is transparent. The doc says "50 = upper hemisphere". The rect's height already sets the extent, so `y2` should be `100%`, or the gradient should use `userSpaceOnUse`.
- evidence: read
- severity: medium

## Perforations hangs when holeRadius and holeSpacing are both 0
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:23 (Perforations.Component)
- scenario: `params: { holeRadius: 0, holeSpacing: 0 }` makes the divisor `max(0, 0) = 0`. `total / 0` is Infinity and `Math.round(Infinity)` is Infinity, so `N = Infinity`, and the `for (i < N)` loop pushes holes until memory runs out. The sibling effects clamp their spacing to a positive floor (Bites `max(2*br + 0.5, …)` with `br ≥ 0.5`, Puffs `max(6, …)`); this one does not.
- evidence: read
- severity: medium

## Bevel leaves an unpainted gap at every seam between its side bands; Bevel2 overlaps its bands to close the same gap
- where: packages/ui/src/components/Badge/effects/Bevel.tsx:78 (pathFor)
- scenario: each run's band spans only its own sample indices, so the quad between the last sample of one run and the first sample of the next belongs to no band. Every change of side (four or more per outline) leaves a sliver of the body uncovered, about total/240 CSS px wide and the full bevel width deep. Bevel2's `pathFor` adds the previous and next sample to each band "so the seams between shade buckets render without gaps". The same problem is answered two ways, and Bevel kept the gap.
- evidence: read
- severity: low

## Bites and Scallops cut a bump off at the midpoint between bumps when irregularity widens it past half a step, leaving a jump in the outline
- where: packages/ui/src/components/Badge/effects/Bites.tsx:28 (Bites.offsetAt); packages/ui/src/components/Badge/effects/Scallops.tsx:28 (Scallops.offsetAt)
- scenario: spacing is clamped to `≥ 2r + 0.5`, but `localR = r * (1 + irr * 0.55 * wobble)` can reach 1.55r. Take `biteRadius: 3, biteSpacing: 6.5, irregularity: 1`: half a step is about 3.25 and localR can reach 4.65. `nearestBump` hands any sample past step/2 to the next bump, so the bite's displacement is still −1.4 px (a scallop's still ≈ 3.3 px) at the midpoint and then drops abruptly to the neighbor's value, which draws a step in the outline. The same happens without irregularity when `N = max(2, …)` forces a step below `2r` on a short perimeter. Spikes avoids this by clamping its half-base to `step / 2`.
- evidence: read
- severity: low

## Spikes does not clamp irregularity, unlike its siblings; past 2 the spike length goes negative, and the corner compensation can flip it back outward or divide by zero
- where: packages/ui/src/components/Badge/effects/Spikes.tsx:57 (Spikes.offsetAt)
- scenario: Puffs, Bites, Scallops and Sunbeams clamp `irregularity` to [0, 1]; Spikes uses it raw. With `irregularity: 3`, `irrMult` reaches −0.5 and `baseLen` goes negative. `baseLen / (1 + comp*kappa*baseLen)` then has a denominator that can be 0, giving `lenCss = Infinity` and an `Infinity`/NaN coordinate in the outline path, or negative, which turns a negative length back into a positive spike. Expected: clamp the range the way the sibling effects do.
- evidence: read
- severity: low

## Sunbeams' gradient axis is 100 viewBox units long at every angle, so at diagonal angles 0..1 does not reach the badge's corners
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:101 (Sunbeams.Component)
- scenario: the comment says the span is chosen "so 0..1 covers the badge fully", but at `gradientAngle: 45` the axis runs from (14.6, 14.6) to (85.4, 85.4). The corners project to −0.21 and 1.21, so `gradientEnd: 1` finishes the fade about 15% of the diagonal short of the far corner, and `gradientStart: 0` starts it past the near corner. A span of `100 * (|cos| + |sin|)` would cover the box.
- evidence: read
- severity: low

## Bevel and Bevel2 inset the inner ring along the viewBox normal instead of the CSS normal, so on a non-square badge the band is skewed and thinner than bevelWidth on slanted edges
- where: packages/ui/src/components/Badge/effects/Bevel.tsx:53; packages/ui/src/components/Badge/effects/Bevel2.tsx:56 (Component)
- scenario: `PerimeterPoint.nx/ny` is a unit normal "in viewBox terms". The inner point is offset by `(nx*w*sx, ny*w*sy)`, which in CSS px is `(nx*w, ny*w)`: length w, but along the viewBox normal. Under a non-uniform viewBox scale that is not perpendicular to the edge in CSS space. On a 200×24 pill's rounded ends, the band leans along the edge and is noticeably narrower than the documented `bevelWidth` CSS px. Axis-aligned edges are unaffected.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/effects/Aqua.tsx
packages/ui/src/components/Badge/effects/Bevel.tsx
packages/ui/src/components/Badge/effects/Bevel2.tsx
packages/ui/src/components/Badge/effects/Bites.tsx
packages/ui/src/components/Badge/effects/Metal.tsx
packages/ui/src/components/Badge/effects/Outline.tsx
packages/ui/src/components/Badge/effects/Perforations.tsx
packages/ui/src/components/Badge/effects/Puffs.tsx
packages/ui/src/components/Badge/effects/Rivets.tsx
packages/ui/src/components/Badge/effects/Scallops.tsx
packages/ui/src/components/Badge/effects/Shadow.tsx
packages/ui/src/components/Badge/effects/Sheen.tsx
packages/ui/src/components/Badge/effects/Spikes.tsx
packages/ui/src/components/Badge/effects/Sunbeams.tsx
packages/ui/src/components/Badge/effects/Woodgrain.tsx
packages/ui/src/components/Badge/effects/bumps.ts
packages/ui/src/components/Badge/effects/glassStrokes.tsx
packages/ui/src/components/Badge/effects/index.ts
packages/ui/src/components/Badge/effects/rangeMask.ts

<!-- done: 8 findings, files read: 19 -->
