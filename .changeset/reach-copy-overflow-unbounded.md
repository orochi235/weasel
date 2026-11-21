---
'@weasel-js/core': minor
---

A group whose `copiesFromPose` carries its children past every finite box is never culled, where it was culled by a view away from the origin. A `BoxImage` may now answer `BOX_ALL` to say that no finite box holds its image.

<!-- entry: fix api -->
