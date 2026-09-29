---
"@weasel-js/paint": patch
"@weasel-js/core": patch
"@weasel-js/svg": patch
"@weasel-js/ui": patch
---

A pattern paint takes a `transform`: the tile's rotation, scale and skew about
its `origin`, as a `PatternTransform` `[a, b, c, d]` in SVG `matrix()` order.
`composePatternTransform({ rotation, scaleX, scaleY, skewX })` builds one and
`decomposePatternTransform` reads one back into those parts; both are exported
from `@weasel-js/paint` and `@weasel-js/core`. The GL renderer samples the tile
through it, and a transform with no inverse draws nothing.

`@weasel-js/svg` writes the transform as `patternTransform="matrix(…)"`, with
the origin as its translation, and reads any `patternTransform` list back into
`origin` and `transform`.

`PatternPicker` (and so `PaintInput`'s pattern mode) has a Rotation field that
edits the rotation and leaves scale and skew alone; picking another tile keeps
the rotation.

Additive: a paint without `transform` paints and serializes as before.
