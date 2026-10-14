---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Deleting an anchor keeps the curve's shape. The segment that replaces the two either side of it keeps the directions they left and arrived with, and its handle lengths are now fitted to them rather than set to a third of the chord, so deleting one anchor of a circle leaves a round arc instead of a flat lobe. An anchor that was inserted on a curve and then deleted gives back the original curve. A gap between two straight segments closes with a straight one.

`fitCubicWithTangents` (`@weasel-js/geom`) is the fit underneath: the one cubic through a run of samples whose control points keep given end tangents.

Breaking: `fitCubicThroughDeletion(prev, next)` becomes `fitCubicThroughDeletion(prev, removed, next)`, since the fit needs the anchor being removed.
