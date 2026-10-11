---
'@weasel-js/ui': patch
---

A `GradientHandles` or `MeshHandles` point jumped to the pointer on the first move of a drag, by up to the handle's radius when it was grabbed near its rim. A handle now moves by exactly how far the pointer moved.
