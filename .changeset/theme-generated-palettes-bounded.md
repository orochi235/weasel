---
'@weasel-js/theme': patch
---

`colorAt` keeps only the most recent generated palettes.

A page whose `generate` count or gates keep changing no longer grows its memory without end.

<!-- entry: fix perf -->
