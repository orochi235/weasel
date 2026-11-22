## A sparkler badge's `outerR`, `innerR` and `rotation` are taken raw, so a non-finite value collapses its outline into the box's corner
- where: packages/ui/src/components/Badge/shapes/Sparkler.tsx:20 (sparklerPath), :38 (Component)
- scenario: `shapeParams={{ rotation: NaN }}` (or `Infinity`, e.g. from a cleared number field or a divide upstream) → `Math.cos(start + i*step)` is NaN for every vertex, `trimNumber` writes each as `0`, and the path is `M 0 0 L 0 0 … Z`: the fill, stroke and focus ring all vanish. `outerR: NaN` sends every other vertex to (0, 0), drawing a zigzag into the top-left corner. Every other shape in the folder reads a non-finite param as its default (`clampParam`/`finiteOr`, pinned by params.test.tsx's "a clamped shape param set to NaN"); here `points` alone is guarded (`repeatCount`), so the same input is answered two ways. Should fall back to `DEFAULTS.outerR`/`innerR`/`rotation` via `finiteOr`.
- evidence: read
- severity: medium

## A starburst badge's `outerR`, `innerR` and `rotation` are taken raw, so a non-finite value collapses its outline into the box's corner
- where: packages/ui/src/components/Badge/shapes/Starburst.tsx:22 (starburstPath), :61 (Component)
- scenario: `shapeParams={{ rotation: Infinity }}` → every `pts[i]` is `[NaN, NaN]`, `trimNumber` prints `0`, and both the plain and the eroded path degenerate to the point (0, 0), so the badge draws no shape and no focus ring. `innerR: NaN` pulls every valley to the corner. `erosion` and `points` in the same function are guarded (`clampParam`, `repeatCount`, and params.test.tsx lists `starburst: ['erosion']` as drawing its default on NaN), but the radii and rotation beside them are not; they should go through `finiteOr(…, DEFAULTS.…)`.
- evidence: read
- severity: medium

## A perforated badge accepts `holeRadius: Infinity` and writes `rx="Infinity"`, an invalid attribute, so the holes silently disappear
- where: packages/ui/src/components/Badge/shapes/Perforated.tsx:27 (PerforatedComponent)
- scenario: `shapeParams={{ holeRadius: Infinity }}` → `clampParam(…, 0, Infinity, …)` keeps Infinity, `rx`/`ry` are Infinity, React renders `rx="Infinity"`, which SVG rejects as invalid, so no ellipse is drawn into the mask and the badge renders as an unperforated rect, where any large finite radius masks the whole body. NaN reads as the default here, but the other non-finite value is passed through; the upper bound should be finite (e.g. half the box) or `finiteOr` applied.
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

<!-- done: 3 findings, files read: 24 -->
