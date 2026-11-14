---
'@weasel-js/ui': minor
---

Badge exports its catalog of shapes, bases, effects, and looks, and `Badge/geometry` exports the curves its polar bases draw.

From `@weasel-js/ui/components/Badge`:

- `BADGE_SHAPES`, `BADGE_BASES`, and `BADGE_EFFECTS` name every built-in shape, base, and effect.
- `badgeShapeRendering(shape)` says whether a shape is drawn in CSS, as its own SVG outline, or composed from a base and effects.
- `badgeEffectZone(effect)` says whether an effect moves the outline (`offset`) or paints under it, over it, or through it (`background`, `foreground`, `mask`).
- `BadgeLook`, `BADGE_LOOKS`, `lookProps(look, tint?)`, `lookAttrs(look, tint?)`, and `lookOf(props)` name a grade or emphasis as one choice and turn it into appearance props, or into JSX attributes for a snippet.

From `@weasel-js/ui/components/Badge/geometry`, each curve as r(s) over one octant, for drawing or editing one outside a badge:

```ts
import { octantBSplineRadius, octantSplineRadius, quatrefoilRadius } from '@weasel-js/ui/components/Badge/geometry';

const r = octantSplineRadius([{ s: 0, r: 48, w: 1 }, { s: 0.5, r: 20, w: 1 }, { s: 1, r: 40, w: 1 }]);
r(0.5); // 20
```

It also exports `OCTANT_SPLINE_DEFAULTS`, `OCTANT_SPLINE_MIN_ANCHORS`, `OCTANT_SPLINE_MAX_ANCHORS`, `OCTANT_BSPLINE_MIN_WEIGHT`, and the `BadgeSplineAnchor` type.

<!-- entry: api -->
