---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

In a 3D move of several roots, a root stored under a container now moves by the same world distance as the first root, as roots stored in world space already did. It used to resolve the drag on its own plane, so it went a different distance and missed a snap target the first root found. A move now hands such a root the lead (`TranslateLead`) expressed in its container's frame, and kernel3d's descriptor applies the lead's change whole rather than flattening it onto the pose's own height.
