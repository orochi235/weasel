---
"@weasel-js/geom": patch
"@weasel-js/stroke": patch
---

A stroke more than twice as wide as the flatten tolerance now flattens its curves in steps of at most 10°. Before, a tight bend under a thick stroke took steps of 40° or more and showed visible facets on the stroke's edges. Thinner strokes still flatten on the same vertices as their fill. `extractPolylines` takes a new `maxTurn` option, and `flattenCubicWithArcLen` and `flattenQuadraticWithArcLen` take a trailing `maxTurn` argument.
