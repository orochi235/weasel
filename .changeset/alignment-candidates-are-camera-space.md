---
'@weasel-js/guides': patch
---

Alignment snapping works on a `parallax` layer. Candidate lines and spacing boxes handed to `alignMoveBehavior`, `alignInsertBehavior`, and `alignResizeBehavior` are always in the camera's world, and so are the lines and gaps they publish; a gesture whose poses are in a plane carries them in to match and back out to publish. `deriveAlignmentGuides` takes `planeOf`, which says which plane a sibling's pose is stored in so its box is carried out to the camera's world. A caller that fed plane coordinates in for siblings on the dragged node's own parallax layer now passes `planeOf` instead.
