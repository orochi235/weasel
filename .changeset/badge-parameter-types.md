---
'@weasel-js/ui': patch
---

Adds API: the types `BadgeProps` is made of, none of which could be imported before.

- `BadgeOwnProps`, every prop a badge takes but `shape`, `shapeParams`, and the DOM attributes it passes through, and `BadgeDomProps`, those attributes.
- `BadgeShapeParams`, what `shapeParams` takes by shape, and the entry for each shape that takes any: `BadgeSquareShapeParams`, `BadgeStarburstShapeParams`, and the rest, each named `Badge<Shape>ShapeParams`.
- `BadgeBase`, the outlines a composed badge is built on, `BadgeBaseParams`, what `baseParams` takes by base, and each entry, named `Badge<Base>BaseParams`. `BadgePuzzleEdge` and `BadgeRibbonEnd` are the values two of them take.
- `BadgeEffect`, the effects a badge can layer, `BadgeEffectSpec`, one entry in `effects`, `BadgeEffectParams`, what an effect takes by type, and each entry, named `Badge<Effect>EffectParams`. `BadgeRangeMaskParams` is the `range` several of them share.
- `BadgeCorner`, the corner a bevel, sheen, rivet, or plaque is lit from.
