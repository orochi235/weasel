---
"@weasel-js/geom": patch
---

The flat math decides "these two directions are one" the same way everywhere. `flatDim`,
`closestOnFlat` and `intersectFlats` used to count two directions as distinct down to 1e-9 rad
apart, while the solve behind `closestBetweenFlats` called them parallel below 1e-6 rad; the solve
also judged a column against the longest one rather than its own length, so a short segment
direction in a snap candidate's span could be dropped at a much wider angle. Both now treat
directions under 1e-6 rad apart as one, measured against each direction's own length.
