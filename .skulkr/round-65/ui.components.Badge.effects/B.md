## A sunbeams `count` or woodgrain `lines`/`knots` of Infinity hangs the render; a huge one stalls it
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:75 (Sunbeams.Component); packages/ui/src/components/Badge/effects/Woodgrain.tsx:28,36 (Woodgrain.Component)
- scenario: `effects: [{ type: 'sunbeams', params: { count: Infinity } }]` (or `woodgrain` with `lines: Infinity` / `knots: 1e9`) → `for (let i = 0; i < cfg.count; i++)` never ends, freezing the tab on render. Nothing bounds these counts, while the shapes' and bases' repeat counts stop at 256 (docs/unruled.md rounds 56, 57, 60) and perforations got a pitch floor in round 62 for the same reason. A fractional count also runs one loop past it: `count: 2.5` draws 3 beams but centers the pattern on a 2.5-beam `totalWidth` (line 69), and `lines: 2.5` spaces 3 lines by `(i+1)/3.5`, leaving the bottom gap wider. Should clamp to a finite integer range.
- evidence: read
- severity: medium

## `NaN` in a bump effect's params turns the whole composed outline into `NaN` path data
- where: packages/ui/src/components/Badge/effects/Spikes.tsx:39 (offsetAt); Bites.tsx:23-25; Scallops.tsx:23-25; Puffs.tsx:23
- scenario: `{ type: 'bites', params: { biteSpacing: NaN } }` → `Math.max(2*br+0.5, NaN)` is `NaN`, so `N` and `step` are `NaN`, `nearestBump` returns `NaN` offsets, and every sample's `dx/dy` is `NaN`; composeOutline sums it in, so `bodyPath` is `M NaN NaN L …` and the badge draws nothing (fill, stroke and every decoration share that path). Same for Spikes `count: NaN` (`Math.max(3, NaN)`), Spikes `count: Infinity` (step 0 → 0/0), Scallops `scallopSpacing`/`scallopRadius: NaN`, Puffs `bumpWidth: NaN`. Perforations reads `NaN` as its default through `clampParam`, and bases/shapes read `NaN` as default (unruled rounds 57, 60); these sibling effects answer the same input differently.
- evidence: read
- severity: medium

## A perforations hole is painted over by every foreground effect, so it vanishes under aqua, metal, bevel, sheen or sunbeams
- where: packages/ui/src/components/Badge/effects/Perforations.tsx:47 (zone: 'mask'), as applied in packages/ui/src/components/Badge/BadgeDeco.tsx (mask `<g>` wraps only `badge-fill`/`badge-stroke`)
- scenario: `effects: [{ type: 'perforations' }, { type: 'aqua' }]` → the holes punch the flat fill, but Aqua's body gradient is drawn after, outside the mask, over the whole silhouette, so the badge shows no holes at all. With `metal` the same; with `bevel`/`sheen`/`sunbeams` the bands and beams fill the hole area where they cross it. A hole should show through the whole stack.
- evidence: read
- severity: medium

## The sunbeams fade's `gradientAngle` is in viewBox units while the beams' `angle` is in CSS degrees, so a diagonal fade comes out at the wrong angle
- where: packages/ui/src/components/Badge/effects/Sunbeams.tsx:97-104 (Sunbeams.Component)
- scenario: the deco SVG is `viewBox="0 0 100 100" preserveAspectRatio="none"`. The beam skew corrects for that (`horizPerVb = tan * (sx / sy)`, line 80), but the gradient vector `(cos, sin)` is laid in the 0..100 square with no correction. On a 200×20 px badge, `gradientAngle: 45` maps to CSS direction `(cos·2, sin·0.2)`, a fade whose isolines lie about 6° off horizontal instead of at 45°. Only 0/90/180/270 come out as documented.
- evidence: read
- severity: low

## Sheen, sunbeams and the aqua/metal gloss stop at the 0..100 viewBox, leaving spike and puff tips that cross it undecorated
- where: packages/ui/src/components/Badge/effects/Sheen.tsx:42; Sunbeams.tsx:133-134 (mask region); Aqua.tsx:101-106; Metal.tsx:103-108
- scenario: a composed outline warped by `spikes`/`puffs`/`scallops` reaches past the viewBox (the deco SVG is `overflow: visible`, and BadgeDeco sizes the perforations mask with `outlineRegion` for exactly this reason). The sheen rect is `0,0,100,100`, the sunbeams mask region `0,0,100,100`, and the gloss rect starts at `y=0` with `width=100`, so on `{ base: …, effects: [{type:'spikes'}, {type:'aqua'}] }` the top spikes above y=0 get no gloss and every spike tip outside the box gets no sheen or beams, a hard line along the box edge across each tip.
- evidence: read
- severity: low

## Sheen looks `lightFrom` up on a plain object, so `'constructor'`/`'toString'` reach the prototype
- where: packages/ui/src/components/Badge/effects/Sheen.tsx:15,35 (FACE_COORDS)
- scenario: `params: { lightFrom: 'constructor' }` (from untyped JSON/lab state) → `FACE_COORDS['constructor']` is `Object`, spread as `{}`, so the gradient silently falls back to SVG's default left→right instead of the default `tl` corner or being rejected. The badge's shape/base/effect tables were moved to null-prototype tables (cc83c57f0e); this table was not.
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

<!-- done: 6 findings, files read: 20 -->
