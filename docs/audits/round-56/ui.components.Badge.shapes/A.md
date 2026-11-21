## Notched's corner arcs overrun the badge when eccentricity is not 1, turning the outline into a self-crossing path
- where: packages/ui/src/components/Badge/shapes/Notched.tsx:15 (notchedPath), clamps at :34-36
- scenario: `r = erosion * 49` is clamped so `r <= 49`, but the arcs use `rx = r * ecc` and `ry = r / ecc`, and neither is held to 50. With ui-lab's own ranges (erosion 0..1, eccentricity 0.3..3), erosion 0.6 + eccentricity 2 gives rx = 58.8, so the top edge runs `M 58.8 0 L 41.2 0`, backward. Erosion 0.5 + eccentricity 0.3 gives ry = 81.7, so the side edges run `L 100 18.3` upward from y = 81.7. The fill then shows as a bow-tie or folded shape, and the stroke crosses itself. Expected: rx and ry each capped at 50 (or r capped at 50/max(ecc, 1/ecc)), so the notches meet at the midpoints at most.
- evidence: read
- severity: medium

## Perforated hangs the render when holePitch is 0, and allocates without bound for a tiny pitch
- where: packages/ui/src/components/Badge/shapes/Perforated.tsx:27-28 (PerforatedComponent)
- scenario: `nH = Math.max(2, Math.round(box.width / cfg.holePitch))`. With `shapeParams={{ holePitch: 0 }}`, `box.width / 0` is Infinity, so `nH` is Infinity and the `for (i < nH)` loop pushes into `notches` until memory runs out, freezing the tab. A pitch like 0.001 on a 100px badge renders 200,000 `<ellipse>` elements in the mask. No lower bound exists (ui-lab's slider stops at 6, but the public `shapeParams` type takes any number). Expected: clamp the pitch to a sane minimum, or cap the hole count, as Receipt does for its teeth with `Math.max(3, Math.floor(teeth))`.
- evidence: read
- severity: medium

## Shield's top-corner arcs reach below the shoulder when erosion is high and shoulderY is low, so the path folds back upward
- where: packages/ui/src/components/Badge/shapes/Shield.tsx:36-46 (ShieldComponent)
- scenario: `ryC = (erosion * 12 / box.height) * 100` is never clamped against `sh` (min 20), and `rxC` is never clamped to 50. On a shield about 38px tall (22px content plus insets top 2 and bottom 14) with ui-lab's erosion 1 and shoulderY 20, ryC is about 31.6. The right arc ends at (100, 31.6), then `L 100 20` climbs back up before the point curve, and the outline crosses itself on both sides. On a badge narrower than 24px, `rxC > 50` and the top edge reverses the same way. Expected: `ryC <= sh` and `rxC <= 50`.
- evidence: read
- severity: low

## Coffin reads shoulderHalfHeight as an increment over headHalfHeight, so most of its range does nothing
- where: packages/ui/src/components/Badge/shapes/Coffin.tsx:30-31 (compose)
- scenario: `headHalfHeight` and `footHalfHeight` are used as absolute half-heights, but `shoulderHalfHeight` is added to the head's (`sH = Math.min(50, hH + sDelta)`). At the defaults (head 23, shoulder 36), sH = 59, which clamps to 50, so the default shoulder is already pinned at full height. In ui-lab (`shoulderHalfHeight: num(36, 0, 45, 1)`), dragging the slider anywhere from 27 to 45 leaves the shape unchanged. A caller passing `shoulderHalfHeight: 40` next to `headHalfHeight: 40`, expecting a straight-sided coffin, gets the shoulders at 50 instead. Expected: either an absolute half-height like its siblings, or a name and default that say it is a delta.
- evidence: read
- severity: low

## Sparkler and Starburst don't validate `points`: 0 emits an invalid path, a fractional count breaks the alternation, and Infinity hangs
- where: packages/ui/src/components/Badge/shapes/Sparkler.tsx:20 (sparklerPath); packages/ui/src/components/Badge/shapes/Starburst.tsx:21 (starburstPath)
- scenario: `total = points * 2` is used raw. `points: 0` (or a negative value) gives `d = ' Z'`, a path with no moveto, so nothing draws and the browser logs a path parse error. `points: 2.5` gives total = 5, an odd count, so two outer vertices sit next to each other at the wrap and one spike goes missing. `points: Infinity` loops forever. Receipt makes the same decision differently: it floors its count and clamps it to at least 3 (`Math.max(3, Math.floor(teeth))`). Expected: the same floor-and-clamp here.
- evidence: read
- severity: low

## A shapeParams key set explicitly to undefined overrides the default and turns the geometry into NaN
- where: packages/ui/src/components/Badge/shapes/Receipt.tsx:38 vs :49 (Component vs insets); the same `{ ...DEFAULTS, ...params }` pattern is in every listed shape with params
- scenario: `<Badge shape="receipt" shapeParams={{ teeth: props.teeth }} />`, with `props.teeth` undefined (allowed, since `exactOptionalPropertyTypes` is off), has the spread replace the default with undefined. Receipt's insets use `params.sideToTopRatio ?? DEFAULTS.sideToTopRatio` and recover, but its Component gets `Math.max(3, Math.floor(undefined))` = NaN, so no teeth are drawn. Likewise Beavis `cornerRadius: undefined` gives erosion NaN, Sparkler `outerR: undefined` writes `NaN` coordinates into the path, and Hexagon `tipHeight: undefined` gives NaN vertices. The same question, "what does a missing param mean", gets two answers within one module. Expected: an undefined value falls back to the default, as the `??` path does.
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

<!-- done: 6 findings, files read: 23 -->
