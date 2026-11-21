## A `quatrefoil` badge's `samples` has no upper bound, so `samples: Infinity` hangs the render
- where: packages/ui/src/components/Badge/shapes/Quatrefoil.tsx:40 (compose), into packages/ui/src/components/Badge/bases/Quatrefoil.tsx:112 (quatrefoilVertices)
- scenario: `<Badge shape="quatrefoil" shapeParams={{ samples: Infinity }}>`. The shape hands `cfg` to the base whole, and the base takes `N = Math.max(24, Math.floor(samples))` = Infinity, then `for (i < N) verts.push(...)` runs until the tab runs out of memory. A large finite value (1e8) allocates that many vertices on every render, and again in `useInsets` (fitsContent is true, so the base builds once more per fit pass). `samples: NaN` gives `N = NaN`, no vertices, and `polygonSampler` then reads `verts[0][0]` of an empty array and throws. Round 56 capped `sparkler`/`starburst` `points` and `receipt` `teeth` through `repeatCount` (docs/unruled.md:3137) but not this count; it should go through `repeatCount(samples, 24)` or an equivalent bound.
- evidence: read
- severity: high

## A `beavis` badge's `points` skips `repeatCount`, so an infinite or NaN count draws NaN spikes
- where: packages/ui/src/components/Badge/shapes/Beavis.tsx:34 (compose)
- scenario: `shapeParams={{ points: Infinity }}` is passed as the spikes effect's `count` unbounded. `Spikes.offsetAt` takes `N = Math.max(3, Math.floor(Infinity))` = Infinity, so `step = totalCss / N = 0` and `nearestBump` divides by a zero step; the offset is NaN, `Math.abs(NaN) > halfBase` is false, and every sample returns a NaN displacement, so the outline path is NaN throughout and nothing draws. `points: NaN` does the same. `sparkler` and `starburst` take the same-named `points` param through `repeatCount` (3..256, NaN as the minimum), so the two places answer the same question differently.
- evidence: read
- severity: medium

## A `receipt` badge's `tearDepth` has no upper bound, so deep tears cross the opposite edge
- where: packages/ui/src/components/Badge/shapes/Receipt.tsx:16 (receiptPath)
- scenario: `tearDepth` is only floored (`Math.max(1, depth)`), and a tooth reaches `baseDepth * 1.1`. At `tearDepth: 50`, right-edge teeth reach x = 45 and left-edge teeth x = 55, so the two zigzags cross and the path self-intersects; the fill (nonzero) and stroke show crossed spikes through the middle of the label. Every other inward geometry param in this directory is clamped to stay inside the box (`crest` topInset ≤ 35, `hexagon` tip ≤ 49, `notched` r ≤ 49); this should cap near 45 so the two tears cannot meet.
- evidence: read
- severity: low

## A `house` badge's `peakHeight` has no upper bound, so the roof rises past the box and its top inset
- where: packages/ui/src/components/Badge/shapes/House.tsx:17 (compose)
- scenario: `peakY = ey - Math.max(0, peakHeight)` with no cap. `shapeParams={{ peakHeight: 100 }}` (default eaveY 32) puts the peak at y = -68, 68% of the badge's height above its own box, while the insets stay a fixed `top: 10`, so the roof draws over whatever sits above the badge. `eaveY` and `roofOverhang` are both clamped; `peakHeight` should be held to `ey` (peak at y ≥ 0), as `crest`/`shield` hold `pointDepth` to 110.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Badge/shapes/Beavis.tsx
packages/ui/src/components/Badge/shapes/Cloud.tsx
packages/ui/src/components/Badge/shapes/Coffin.tsx
packages/ui/src/components/Badge/shapes/Crest.tsx
packages/ui/src/components/Badge/shapes/Hexagon.tsx
packages/ui/src/components/Badge/shapes/House.tsx
packages/ui/src/components/Badge/shapes/Notched.tsx
packages/ui/src/components/Badge/shapes/Perforated.tsx
packages/ui/src/components/Badge/shapes/Pill.tsx
packages/ui/src/components/Badge/shapes/Plain.tsx
packages/ui/src/components/Badge/shapes/Plaque.tsx
packages/ui/src/components/Badge/shapes/Postage.tsx
packages/ui/src/components/Badge/shapes/Quatrefoil.tsx
packages/ui/src/components/Badge/shapes/Receipt.tsx
packages/ui/src/components/Badge/shapes/Ribbon.tsx
packages/ui/src/components/Badge/shapes/Scalloped.tsx
packages/ui/src/components/Badge/shapes/Shield.tsx
packages/ui/src/components/Badge/shapes/Sparkler.tsx
packages/ui/src/components/Badge/shapes/Square.tsx
packages/ui/src/components/Badge/shapes/Starburst.tsx
packages/ui/src/components/Badge/shapes/Urn.tsx
packages/ui/src/components/Badge/shapes/Wood.tsx
packages/ui/src/components/Badge/shapes/index.ts
packages/ui/src/components/Badge/shapes/params.ts

<!-- done: 4 findings, files read: 24 -->
