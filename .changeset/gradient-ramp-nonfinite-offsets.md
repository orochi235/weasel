---
"@weasel-js/renderer": patch
---

Gradients whose stop lists differ only in a NaN or infinite offset each draw their own ramp, rather than sharing whichever was drawn first.

<!-- entry: fix visual -->
