---
'@weasel-js/kernel3d': patch
---

kernel3d's README says how containers select: as in 2D, a click on a nested node selects its outermost container, a double-click enters it, and a click inside then selects the next level in. This needs nothing from a host beyond `<SceneCanvas>`'s own select tool, and is now under test.
