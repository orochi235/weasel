---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Fixes: the selection outline, the corner handles, and the rotate badge were drawn on the unskewed box of a node whose pose carries a `transform`. They are drawn on the shape as `poseFrameOf` draws it.

Adds API: `Bounds` carries an optional `transform` beside its `rotation`, and the bounds a canvas hands its chrome carry the pose's. `rotationHandle` reads it.
