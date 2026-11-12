---
"@weasel-js/kernel3d": patch
---

A move through a camera that casts no ray leaves the solid where it is, rather than moving it through an earlier gesture's camera.

A drag whose camera stops casting rays partway, as when its pane collapses, still carries on through the last camera that did.

<!-- entry: fix -->
