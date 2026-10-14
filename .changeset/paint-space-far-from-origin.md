---
'@weasel-js/renderer': patch
---

A gradient or a pattern drawn by the path programs keeps its place far from the origin. The matrix that takes a fragment to paint space is rebased on the CPU, in doubles, before it is uploaded: a gradient's is measured from the gradient's own start point or center, and a pattern's drops whole tiles from its translation. At world x = 262,144 and 64x zoom a `units: 'world'` gradient used to move in 2 px steps as the view panned.
