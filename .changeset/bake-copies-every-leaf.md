---
'@weasel-js/symmetry': patch
---

`bakeSymmetry` copies every leaf whose pose is a box, text and images included. A copy keeps its leaf's data, and its pose is carried through the copy's turn or mirror as a `rotation` and `transform` (`carryPose`, exported), so a paint laid out in the shape's box, a gradient say, turns and mirrors with it the way the live copy drew it. A path copy no longer has its outline rewritten into world coordinates. `skipped` now names only leaves whose pose is not a box.
