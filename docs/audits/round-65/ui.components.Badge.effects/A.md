# Audit round 65 — ui.components.Badge.effects

## Sunbeams' fade mask stops at the 0..100 viewBox, so beams vanish from any part of the outline that bloat or an outward effect pushes past the box
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:133 (Sunbeams.Component, `<mask … x="0" y="0" width="100" height="100">` and its `<rect>`), with the gradient span at :100
- scenario: `<Badge base="rounded-rect" bloat={4} effects={[{type:'spikes'}, {type:'sunbeams'}]}>`. The composed outline reaches outside 0..100 (`.deco` is `overflow: visible`, and BadgeDeco sizes its own body mask with `outlineRegion(outline, 10)` for exactly this reason). The beams are clipped to the body and also masked by a rect covering only 0..100, so wherever the body extends past the box (spike tips, the bloated rim) they are cut off sharply at the box edge, even with `gradientStart: 0, gradientEnd: 1`. Expected: the mask (and the 0..1 gradient span) covers the outline's region, as the body mask does.
- evidence: read
- severity: medium

## Sheen, and the Aqua and Metal gloss, paint a fixed 0..100 rect, so a body that reaches past the box gets none on those parts
- where: packages/ui/src/components/Badge/effects/Sheen.tsx:42 (Sheen.Component); packages/ui/src/components/Badge/effects/Aqua.tsx:101 and packages/ui/src/components/Badge/effects/Metal.tsx:103 (gloss `<rect x="0" y="0" width="100" height={glossExtent}>`)
- scenario: `effects={[{type:'spikes'}, {type:'aqua'}]}` or `bloat={3}` with `sheen`/`metal`. The rects are clipped to `sampler.bodyPath` but never reach outside 0..100, so the topmost spikes (y < 0), which should be the glossiest, get no gloss, and the sheen ends in a hard line along the box edge on every side. In Aqua and Metal the body gradient uses the default objectBoundingBox units on `bodyPath`, so it spans the outline's real bbox while the gloss spans the viewBox. When the outline is bigger than the box, the two passes and the documented "viewBox units" `equator` no longer line up.
- evidence: read
- severity: low

## Sunbeams' `gradientAngle` is in stretched viewBox space while its `angle` is corrected to CSS space
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:97-104 (gradient axis) vs :79-80 (`horizPerVb = tan * (sx / sy)`)
- scenario: a 200×24 badge with `angle: 45, gradientAngle: 45`. The beams lean at 45° on screen, because their shear is scaled by `sx/sy`. The fade axis is taken as (cos 45°, sin 45°) in the 100×100 viewBox, which `preserveAspectRatio="none"` stretches to about 6.8° on screen. So the same degrees mean two different on-screen angles in one effect, and `gradientAngle: 90` is the only value that looks the same at every aspect. Expected: convert the gradient direction with `sx/sy` as the beam angle is.
- evidence: read
- severity: low

## Woodgrain's knot "circles" are sized in viewBox units, so they squash to slivers on a wide badge
- where: packages/ui/src/components/Badge/effects/Woodgrain.tsx:54-55 (Woodgrain.Component, `rx={3} ry={2.4}` / `rx={1.2} ry={1}`)
- scenario: a 150×24 badge. The viewBox is stretched non-uniformly, so the outer knot is 4.5 px wide by 0.58 px tall and the inner one 1.8 × 0.24 px: a flat dash, not the knot circle the param doc promises. Every other round feature in this directory (Rivets, Perforations holes) scales its radii by `100/boxW` and `100/boxH` to stay round. Woodgrain ignores `boxW`/`boxH` entirely.
- evidence: read
- severity: low

## A negative spike `length` throws spikes outward on tight corners and nowhere else
- where: packages/ui/src/components/Badge/effects/Spikes.tsx:74-76 (Spikes.offsetAt)
- scenario: `{type:'spikes', params:{length:-8}}` on a `rounded-rect` with radius 4 (κ ≈ 0.25). On straight edges κ = 0, so `max(0, baseLen)` gives 0 and no spike is drawn. On the corner arc, `1 + comp·κ·baseLen` is negative wherever κ·|baseLen| > 1, so `baseLen / (negative)` is positive and outward spikes appear on the corners only. The parameter is unclamped, so this input is reachable. Expected: either clamp `length` (and so `scale`) to ≥ 0 before the compensation, or let a negative length mean inward spikes consistently.
- evidence: read
- severity: low

## The perforations effect ignores `phase`, so its holes don't crawl when the badge's other perimeter patterns do
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:32 (Perforations.Component, `sCss = (i + 0.5) * step`)
- scenario: `<Badge crawl base="rounded-rect" effects={[{type:'scallops'}, {type:'perforations'}]}>`. Scallops, bites, puffs and spikes all offset their bumps by `phase` through `nearestBump`, and `ShapeRenderProps.phase` documents phase as "applied to perimeter patterns when the badge has `crawl` enabled". Perforations is an evenly spaced perimeter pattern too, but it never reads the `phase` it is passed. Its holes stay put while the scallops beside them slide, so holes and bumps drift out of register. Expected: centers at `(i + 0.5 + phase) * step`.
- evidence: read
- severity: low

## Rivets sit at the box's corners whatever the base, so on a non-rectangular outline they float outside the badge
- where: packages/ui/src/components/Badge/effects/Rivets.tsx:27-32 (Rivets.Component)
- scenario: `base="quatrefoil"` (or `polygon`, or `octant-spline` with round ends) with `effects={[{type:'rivets'}]}`. The four rivets are placed at `(inset, inset)` from the box corners. They don't use `sampler` and aren't clipped to `bodyPath`, unlike every other foreground decoration here (Bevel, Sheen, Woodgrain, Sunbeams). So they render as dots on the page outside the silhouette. Expected: place them relative to the outline, or at least clip them to the body.
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
packages/ui/src/components/Badge/effects/rangeMask.ts

<!-- done: 7 findings, files read: 20 -->
