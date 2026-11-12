---
'@weasel-js/ui': minor
---

CurveEditor's keys, anchors and bezier handles, and GradientHandles' and MeshHandles' points, draw at the theme's `--wzl-handle-*` sizes.

A curve layer's render context gains `handleHalf(token)`, half a handle's size under the theme in force, for a custom layer to size its handles the same way.

<!-- entry: fix api -->
