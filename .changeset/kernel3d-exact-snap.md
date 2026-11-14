---
'@weasel-js/kernel3d': minor
---

A 3D snap stores the coordinate it snapped to: a box moved or inserted onto a ground-grid line at 0.5 is stored at 0.5 exactly.

`createSnap`'s sessions report the world point as `SnapOutcome.landing`, typed `Landing3d`, which `createPoseDescriptor`'s `translate` and `createInsert` store.

<!-- entry: fix api -->
