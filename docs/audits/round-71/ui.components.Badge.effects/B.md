# Audit round 71 — ui.components.Badge.effects (blind reviewer)

## Aqua and Metal pass unclamped tint/darkness percentages into `color-mix()`, which rejects them and drops the stop's color
- where: packages/ui/src/components/Badge/effects/Aqua.tsx:77-78 (Aqua.Component); packages/ui/src/components/Badge/effects/Metal.tsx:71-72 (Metal.Component)
- scenario: `{ type: 'aqua', params: { equatorTint: 120 } }` or `baseTint: -5`, or `{ type: 'metal', params: { topDarkness: 110 } }` → `color-mix(in srgb, … 120%, white)` is invalid CSS, so the gradient stop's `stopColor` is dropped and the stop paints the initial black: the equator band / base / top turns black instead of near-white/accent. Other unit-range params in the same files are held (`specularity` clamped to 0..1; Sheen/Shadow/Woodgrain clamp their opacities), and round 58 ruled the identical `color-mix` problem for `plaque({ mix })` by refusing out-of-range values; here they are neither clamped nor refused.
- evidence: read
- severity: medium

## Adjacent bevel bands overlap by one sample, so every seam double-paints the translucent bevel fill
- where: packages/ui/src/components/Badge/effects/bevelBands.ts:48-51 (bevelBands)
- scenario: each run is widened by one sample on *both* ends, so band A (ending at A_last, extended to B_first) and band B (starting at B_first, extended back to A_last) both cover the quad between A_last and B_first. The bevel classes fill with rgba at 0.10–0.32 alpha, so that quad composites twice: a visible darker/lighter radial stripe across the bevel at every seam. In `bevel2` it is worse, because buckets 1/2 and 3/4 map to the same class (`SHADE_CLASSES` duplicates) yet are separate runs, so a stripe appears in the middle of what should be one uniform shade. Widening only one side closes the gap without the overlap.
- evidence: read
- severity: low

## Woodgrain places knots at fixed viewBox coordinates while its grain lines follow the outline's region
- where: packages/ui/src/components/Badge/effects/Woodgrain.tsx:45-50 (Woodgrain.Component)
- scenario: lines are spread over `outlineRegion(sampler, 0)` (lines 34-39), but knots sit at `50 ± 30·osc` in raw viewBox units regardless of region. On an outline that extends past 0..100 (spikes, puffs, bloat) the knots cluster off-center relative to the grain; on a body that does not fill its box, knots land outside the body and are clipped away. One effect answers "where on the body" two ways.
- evidence: read
- severity: low

## `irregularity: Infinity` (and `cornerCompensation: Infinity`) reads as 1, not the default, in the perimeter-warping effects
- where: packages/ui/src/components/Badge/effects/Puffs.tsx:27; packages/ui/src/components/Badge/effects/Spikes.tsx:44-45; packages/ui/src/components/Badge/effects/bumps.ts:40 (bumpRadius, used by Bites/Scallops)
- scenario: `clampParam` maps only NaN to the fallback; `Infinity` is clamped to the upper bound 1. So `{ type: 'puffs', params: { irregularity: Infinity } }` draws full irregularity, where round 65 (docs/unruled.md:3606) ruled that "NaN or an infinite number in a spikes, puffs, bites, or scallops param reads as that param's default" (0 here). Every other param in these files uses `finiteOr`, which does honor the ruling.
- evidence: read
- severity: low

## A non-finite entry in `range` silently removes the whole effect
- where: packages/ui/src/components/Badge/effects/rangeMask.ts:10-15 (rangeMask)
- scenario: `range: [NaN, 0.5]` (a slider or parse yielding NaN) → `a === b` false, `a < b` false, so the wrap branch runs and `u >= NaN || u <= NaN` is false for every sample: mask 0 everywhere and spikes/puffs/bites/scallops/perforations vanish. The sibling params read a NaN as their default per round 65; `range`'s default (no range, whole perimeter) is never reached.
- evidence: read
- severity: low

## Perforations accepts `holeRadius: Infinity`, producing infinite ellipse radii
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:26-27,37-38 (Perforations.Component)
- scenario: `clampParam(Infinity, 0, Infinity, 3)` returns Infinity; pitch becomes Infinity, N = 2, and each hole gets `rx="Infinity"`, an invalid attribute, so the holes don't render (or render per engine quirks) instead of the radius reading as its default the way the warping effects' non-finite params do.
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
packages/ui/src/components/Badge/effects/bevelBands.ts
packages/ui/src/components/Badge/effects/bumps.ts
packages/ui/src/components/Badge/effects/glassStrokes.tsx
packages/ui/src/components/Badge/effects/index.ts
packages/ui/src/components/Badge/effects/lightCorner.ts
packages/ui/src/components/Badge/effects/rangeMask.ts

<!-- done: 6 findings, files read: 21 -->
