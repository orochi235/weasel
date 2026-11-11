---
"@weasel-js/renderer": patch
---

`strokeReachAt`, and so culling and retained-surface bounds, now covers a `{ px }` stroke's per-vertex widths under a transform that shrinks one axis more than the other. Such a ribbon is built in the transform's stretch, where a world width's miter could reach past the bound and be culled while on screen; the bound now grows those widths by the square of the transform's stretch.
