---
'@weasel-js/theme': patch
---

`readCssNumber` and `resolveCurrentColor` read a value holding a very long run of digits in time linear in its length.

<!-- entry: fix perf -->
