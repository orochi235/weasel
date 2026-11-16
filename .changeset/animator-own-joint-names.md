---
'@weasel-js/animator': patch
---

Joint, field and interpolation names like `constructor` or `__proto__` read and write as their own entries, not `Object.prototype` members.

A pose, skin or IK limit table without a joint named `constructor` treats it as absent in `mirrorPose`, `resolveSkeleton`, `solveIk`, `skeletonAxes` and `setWeights`; a pose with a `__proto__` joint keeps it as an own key; a clip naming interpolation `toString` reports it missing; and an element style key `__proto__` is skipped.

<!-- entry: fix -->
