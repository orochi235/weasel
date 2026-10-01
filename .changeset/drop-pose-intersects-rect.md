---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

Remove `PoseDescriptor.intersectsRect`. Nothing in the kit has read it since marquee and lasso began testing a node's drawn outline, so the built-in descriptors (`RECT_POSE_DESCRIPTOR`, `ROTATED_POSE_DESCRIPTOR`, `pathPoseDescriptor`, the auto descriptor, and kernel3d's) no longer implement it. This is a breaking removal of a public field for anyone implementing a custom `PoseDescriptor`: an object literal typed as `PoseDescriptor` that still declares `intersectsRect` now fails the excess-property check. Delete the method; nothing called it.
