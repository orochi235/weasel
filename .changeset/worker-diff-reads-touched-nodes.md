---
'@weasel-js/core': patch
---

A render worker's scene copy is kept up to date from the nodes each edit touched, not a fresh snapshot of the whole scene per frame.

<!-- entry: perf -->
