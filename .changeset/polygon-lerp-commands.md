---
'@weasel-js/core': patch
---

`pathPoseDescriptor.lerp` throws for two polygons whose commands differ.

At the end of a tween it lands on the end polygon's fill rule and other fields.

<!-- entry: fix -->
