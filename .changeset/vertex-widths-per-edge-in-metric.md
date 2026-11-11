---
"@weasel-js/stroke": patch
---

A `{ px }` stroke with `vertexWidths`, under a transform that stretches one axis more than the other, now draws each per-vertex width at its true size along both edges of a corner. Each corner was scaled along the bisector of its two edges, which in a strongly stretched view drew the ribbon many times too wide along one of them, past the bounds the renderer culls by. `populatePolylineWidths` given a `scale` now splits each corner into two coincident points, one per edge, as a nib already does.
