# Audit round 68: ui.components.Badge.shapes

## `sparkler` and `starburst` draw a NaN path for a non-finite `outerR`, `innerR` or `rotation`
- where: packages/ui/src/components/Badge/shapes/Sparkler.tsx:20 (sparklerPath); packages/ui/src/components/Badge/shapes/Starburst.tsx:22 (starburstPath)
- scenario: `<Badge shape="starburst" shapeParams={{ rotation: Infinity }}>` (or `outerR: NaN`, `innerR: Infinity`, as a slider or a parsed field can produce) → `Math.cos(Infinity)` / `NaN * …` puts `NaN` coordinates into every `d` (fill, stroke and the focus ring), so the badge's outline is a malformed path and draws nothing. Every other unbounded param in the shape/base layer reads a non-finite value as its default: `finiteOr` in params.ts exists for exactly this ("for a param with no bounds to hold it to"), and the round 60 ruling in docs/unruled.md makes an infinite `rotation` read as its default in the bases (quatrefoil, octant-spline). These two shapes take `outerR`, `innerR` and `rotation` raw, so the same decision is answered two ways. Should be `finiteOr(…, DEFAULTS.…)` on each.
- evidence: read
- severity: medium

## The `perforated` shape lets holes overlap that the `perforations` effect keeps apart
- where: packages/ui/src/components/Badge/shapes/Perforated.tsx:30 (PerforatedComponent)
- scenario: `shapeParams={{ holeRadius: 8, holePitch: 4 }}` → the shape clamps the pitch only to `MIN_HOLE_PITCH` (1 px), so holes 16 px wide sit 4 px apart and merge into one continuous bite that eats the whole edge band. The `perforations` effect (effects/Perforations.tsx:27) holds its pitch to at least `2 * holeRadius` so holes never overlap. The two implementations of the same perforated edge answer "how close may holes sit" differently; the shape should take `Math.max(2 * holeRadius, cfg.holePitch)` as the effect does.
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

<!-- done: 2 findings, files read: 24 -->
