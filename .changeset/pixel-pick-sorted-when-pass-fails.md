---
'@weasel-js/core': patch
---

A pixel pick whose later id frame cannot be read still returns its hits back-to-front, so the last one is the topmost.

<!-- entry: fix -->
