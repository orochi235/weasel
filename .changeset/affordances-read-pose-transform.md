---
'@weasel-js/core': patch
---

Fixes: on a node whose pose carries a `transform`, the corner handles, the rotate ring, and the rotate badge took presses where they would sit on the unskewed box. Each is hit and painted where the node is drawn, and a corner-resize hit names its fixed corner there.

Breaking: `TargetTransform` is the target's frame as two matrices, `{ identity, toWorld, toLocal }`, where it was a pivot with a cosine and a sine, and `annulusSemiAxes` takes one as its third argument where it took a rotation in radians. An `AffordanceRegion`'s local frame is its target bounds' `rotation` and `transform` together.
