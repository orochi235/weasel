---
"@weasel-js/kernel3d": patch
---

The 3D pose descriptor's `remapBounds` leaves a pose exactly where it was when the source and destination rectangles are the same. Rounding in the screen map moved it by an ulp or so, so a resize that changed nothing still edited the node.
