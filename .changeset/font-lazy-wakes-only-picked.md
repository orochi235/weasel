---
'@weasel-js/font': patch
---

Text resolving a font face fetches only the lazily declared variant it will draw in, never the family's other declared variants.

<!-- entry: fix perf -->
