I couldn't write `.skulkr/out/findings.md` because permission to write it was denied, so the whole document is below.

# Findings: ui.components.Badge.effects

## Outline effect scales a non-scaling stroke a second time, so `width` is not CSS px
- where: packages/ui/src/components/Badge/effects/Outline.tsx:34 (Outline.Component)
- scenario: `vectorEffect="non-scaling-stroke"` already strokes in CSS px, ignoring the 100×100 viewBox stretch. The base's own `.badge-stroke` (Badge.module.css:50) uses a bare `1px` with the same vector-effect. Outline still multiplies `width` by `max(100/boxW, 100/boxH)`. On an 80×24 badge, `width: 1` draws a stroke of about 4.2 px; on a 200×200 badge it draws 0.5 px. The stroke weight changes with the badge's size, against the doc's "Stroke width in CSS px".
- evidence: read
- severity: medium

## Aqua and Metal bezel and rim strokes are scaled twice in the same way
- where: packages/ui/src/components/Badge/effects/glassStrokes.tsx:66 (GlassStrokes)
- scenario: `widthScale = max(100/boxW, 100/boxH)` multiplies `bezelWidth` and `rimWidth`, both documented as CSS px, on paths that also carry `vectorEffect="non-scaling-stroke"`. An 80×22 aqua or metal badge draws its "1 px" bezel and rim at about 4.5 px, and a badge wider and taller than 100 px draws them thinner than 1 px. They should stay at the requested px at any box size.
- evidence: read
- severity: medium

## Aqua and Metal gloss fades out at a quarter of the body, not at `glossExtent`
- where: packages/ui/src/components/Badge/effects/Aqua.tsx:87 (Aqua.Component); same at packages/ui/src/components/Badge/effects/Metal.tsx:93
- scenario: the gloss gradient uses the default `gradientUnits="objectBoundingBox"`, so `y2={glossExtent%}` is a fraction of the filled rect's own height. That rect is already `glossExtent` tall. With the default `glossExtent: 50`, the gradient reaches opacity 0 at 25 viewBox units, and the lower half of the gloss rect pads with the transparent last stop. The gloss covers the top quarter, not the "upper hemisphere" the param doc promises; in general it covers glossExtent²/100. `y2` should be `100%`, or the gradient should use userSpaceOnUse.
- evidence: read
- severity: medium

## Irregular scallops and bites break the outline with a step halfway between bumps
- where: packages/ui/src/components/Badge/effects/Scallops.tsx:28 (Scallops.offsetAt); same at packages/ui/src/components/Badge/effects/Bites.tsx:28
- scenario: the spacing clamp (`ss >= 2*sr + 0.5`) only keeps a bump inside half a step at its nominal radius. Irregularity scales `localR` up to 1.55×, and `nearestBump` hands each sample to its nearest bump only. With the default scallops (`sr=4`, half step 5) and `irregularity: 1`, a bump with localR about 6.2 still displaces by about 1.9 px at |ds|=5. The neighbor that takes over just past the midpoint displaces 0 there, so the outline jumps by about 1.9 px: a notch or cliff instead of a continuous curve. Bites with default params hit the same jump (localR up to 4.65 against a half step of about 4.06). Sampling both neighbors, or clamping `localR` to half a step, would keep the outline continuous.
- evidence: read
- severity: low

## Spikes leaves `irregularity` unclamped, unlike its sibling bump effects; values above 2 draw inverted or unbounded spikes
- where: packages/ui/src/components/Badge/effects/Spikes.tsx:57 (Spikes.offsetAt)
- scenario: Puffs, Bites and Scallops clamp irregularity to [0, 1]; Spikes uses `cfg.irregularity` raw. At `irregularity: 3`, `irrMult = 1 + 1.5*wobble` goes negative for some spikes, so `baseLen < 0`. On a corner (kappa > 0), the compensation denominator `1 + comp*kappa*baseLen` can then cross zero, and `max(0, baseLen/denom)` comes out a large positive length, or Infinity (and NaN where a normal component is 0). The result is a spike shooting off the badge, or a NaN path. The same param is answered two ways across the bump effects.
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

<!-- done: 5 findings, files read: 19 -->