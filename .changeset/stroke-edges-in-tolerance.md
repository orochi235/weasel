---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

A thick stroke flattens its path so its edges, half a width out, stay within the flatten tolerance of the true ones,
in place of capping every piece at 10° of turn. A bend whose edges sit far out still subdivides as finely as it
needs; a wiggle smaller than the stroke no longer does, so a 4-wide stroke over 512 small curves flattens to 1,750
points where it took 10,034. Breaking for callers of `extractPolylines`, `flattenCubicWithArcLen` and
`flattenQuadraticWithArcLen`: the `maxTurn` option and argument are replaced by `offset`, the distance out from the
path its outermost edge sits.
