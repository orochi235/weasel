---
"@weasel-js/guides": patch
---

Equal spacing snaps a line lying between two boxes to their gaps.

`matchSpacing`, `measureGaps` and `spacingSnapSource` count a box with no extent across the axis as in the row of any box whose range holds it. Boxes with extent still have to share some of it, not merely touch.

<!-- entry: fix -->
