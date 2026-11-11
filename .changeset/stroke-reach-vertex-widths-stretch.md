---
"@weasel-js/renderer": patch
---

A `{ px }` stroke with per-vertex widths is no longer culled while on screen under a transform that stretches one axis more than the other.

`strokeReachAt`, which culling and retained-surface bounds read, grows those widths by the square of the transform's stretch.

<!-- entry: fix visual -->
