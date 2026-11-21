---
'@weasel-js/renderer': patch
---

A mesh patch whose color does not parse is left undrawn instead of throwing from every frame. A development warning names the color; a patch with fewer than four colors is skipped too.

<!-- entry: fix -->
