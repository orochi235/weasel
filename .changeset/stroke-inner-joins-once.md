---
'@weasel-js/stroke': patch
---

A stroke's ribbon no longer covers the inside of a turn twice. The two segments meeting at a join used to overlap past
the corner on the inside of the turn, so a translucent stroke blended twice there: half-transparent red read alpha 192
inside each corner of a stroked square where Canvas2D reads 128, with every join. Their inner corners now move to where
their inner edges cross, and the join is drawn as a fan from that point, for miter, bevel and round joins, on open and
closed paths and along flattened curves. Where a turn is tighter than the stroke's half-width, so that the crossing lies
past a segment's far end, the segments keep their corners and still overlap there.
