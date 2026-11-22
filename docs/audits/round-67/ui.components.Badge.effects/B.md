# Audit round 67 — ui.components.Badge.effects

## A `bevel2` effect with a non-finite or non-numeric `lightFrom` paints every band solid black
- where: packages/ui/src/components/Badge/effects/Bevel2.tsx:39-45 (Bevel2.Component, bucketFor / lightDirFor)
- scenario: `{ type: 'bevel2', params: { lightFrom: NaN } }`, or `lightFrom: 'tl'` (the corner form `bevel`, `sheen` and `rivets` take, passed through JSON or an untyped lab control), or `Infinity`. `lightDirFor` returns `{ lx: NaN, ly: NaN }`, so `t` is `Math.max(0, Math.min(NaN, 0.9999))` = NaN. `Math.floor(NaN * 6)` is NaN, and `SHADE_CLASSES[NaN]` is `undefined`, so every band `<path>` renders with no class and SVG's default `fill: black`. Because `NaN !== NaN`, `bevelBands` also never joins two samples, so the result is 240 overlapping black slivers: an opaque black bevel ring over the badge. It should either fall back to the default 315° (as round 65 ruled for NaN in the offset effects' params) or throw a `RangeError` (as `bevel`, `sheen` and `rivets` do for a bad `lightFrom`, via `lightCorner`). As it is, the same param name answers bad input in two different ways across the sibling effects, and this one fails silently.
- evidence: read
- severity: medium

## A NaN opacity or intensity in `shadow`, `sheen`, `woodgrain` or `sunbeams` draws at full strength instead of at the default
- where: packages/ui/src/components/Badge/effects/Shadow.tsx:25 (Shadow.Component); Sheen.tsx:30; Woodgrain.tsx:54; Sunbeams.tsx:96
- scenario: every one of these clamps with `Math.max(0, Math.min(x, 1))`, which passes NaN through. For Shadow, `opacity: NaN` gives `fill="rgba(0, 0, 0, NaN)"`. That is an invalid value, so the fill falls back to SVG's initial black, and the shadow comes out fully opaque instead of 0.28. For Sheen, `intensity: NaN` gives `stopOpacity="NaN"`, which is invalid, so the stop is drawn at opacity 1 and the gradient's corners go solid black and white. For Woodgrain, `intensity: NaN` sets the group's `opacity` to NaN, which reads as 1. For Sunbeams, `opacity: NaN` turns each beam into an opaque white polygon. Round 65 ruled that NaN reads as the param's default for the offset effects (`clampParam` / `finiteOr`). These Component effects never got that treatment, so a NaN coming from a lab slider or a parse makes the effect as strong as it can be. The same goes for `metal`'s `specularity`: NaN produces `color-mix(... NaN%, white)`, an invalid stop color.
- evidence: read
- severity: low

## `rivets` measures its corner entry from the farthest outline crossing behind the corner when the outline reaches past the box
- where: packages/ui/src/components/Badge/effects/Rivets.tsx:37-39 (cornerEntry)
- scenario: `cornerEntry` keeps the smallest `lambda` along the corner's diagonal and never requires `lambda >= 0`. The outline can extend outside the 0..100 box: `outlineRegion` widens for that case, and offset effects such as `spikes` or `puffs` push it outward. When it extends past a corner, the diagonal through that corner also crosses the outline behind it (negative `lambda`). The minimum then picks that outward crossing rather than the first one going inward from the corner. The rivet lands at `entry + inset`, near or outside the box corner, and the body clip cuts it partly or wholly away. The doc says the rivet is inset from where the line "first meets the outline" going in from the corner. It should consider only `lambda >= 0`, and fall back to the corner itself when the corner is already inside the body.
- evidence: read
- severity: low

## The `aqua` doc says `equatorSpread` is the band's half-width, but the band below the equator is 1.6× wider
- where: packages/ui/src/components/Badge/effects/Aqua.tsx:28-29, 74-75 (BadgeAquaEffectParams.equatorSpread, Aqua.Component)
- scenario: `equatorSpread: 10` with `equator: 50` puts the stops at 40% and 66%, not at 40% and 60% as "half-width of the transition band around the equator" promises. `metal`, documented with the same words, uses a symmetric ±spread (Metal.tsx:65-66). So the same param answers the question two ways across the two glass effects, and the aqua doc describes neither of them exactly.
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

<!-- done: 4 findings, files read: 21 -->
