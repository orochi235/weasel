# Audit round 71 — ui.components.Badge.effects

## An infinite `perforations` `holeRadius` draws no holes at all, where the `perforated` shape holds it to the box
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:26 (Perforations.Component)
- scenario: `{ type: 'perforations', params: { holeRadius: Infinity } }`. `clampParam(Infinity, 0, Infinity, 3)` keeps `Infinity`, so `pitch` is `Infinity`, `N` is 2, and `rx`/`ry` are `Infinity`; React writes `rx="Infinity"`, an invalid length, and the ellipses render nothing, so the mask punches no holes. Round 68 ruled that the `perforated` shape's `holeRadius` stops at the box's longer side, so an infinite one masks the whole badge. The same param on the effect gets a different answer. Likewise `holeSpacing: Infinity` becomes a 2-hole pattern rather than the default.
- evidence: read
- severity: low

## `aqua` and `metal` tint and darkness mixes outside 0..100 produce invalid `color-mix()`, and those gradient stops turn black
- where: packages/ui/src/components/Badge/effects/Aqua.tsx:77-78; packages/ui/src/components/Badge/effects/Metal.tsx:71-72 (Component)
- scenario: `aqua` with `equatorTint: 120` or `baseTint: -10`, or `metal` with `topDarkness: 150`. The value goes straight into `color-mix(in srgb, X 120%, white)`. A percentage outside 0%..100% is invalid, so the inline `stopColor` is dropped and the stop falls back to the initial `stop-color`, black. The bright equator then draws as a black band. The params are documented as 0..100, and `finiteParams` only replaces non-finite numbers. `metal` clamps `specularity` to 0..1 in the same function but leaves these unclamped.
- evidence: read
- severity: low

## A negative `rivets` `radius` writes negative `rx`/`ry`, so no rivets draw
- where: packages/ui/src/components/Badge/effects/Rivets.tsx:54-55 (Rivets.Component)
- scenario: `{ type: 'rivets', params: { radius: -2 } }`. `finiteParams` lets it through, so `rx = -2 * sx` goes onto all three ellipses. A negative `rx` is an SVG error and the ellipse isn't rendered, so the effect silently draws nothing. The highlight offsets (`litDx`/`litDy`) also flip sides. Every other size param in the folder is clamped or floored (`perforations`' `holeRadius` reads a negative as 0, `bites`/`scallops` floor at 0.5).
- evidence: read
- severity: low

## `sunbeams` angle jitter can push a beam across 90°, flipping its lean or stretching it to ±1e16
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:66,86 (Sunbeams.Component)
- scenario: `angle: 85, irregularity: 1`. `angleJitter` adds up to ±8°, so some beams get `angle + jitter` ≥ 90°. Near 90°, `Math.tan` returns ~1.6e16 and the parallelogram's `halfShear` covers the whole body, so one beam floods it. Past 90°, `tan` goes negative and that beam leans left while its neighbors lean right. The jittered angle is never held inside (-90°, 90°), and the base `angle` isn't either: `angle: 90` alone gives a near-infinite shear instead of horizontal-limit beams.
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
