---
'@weasel-js/bidi': patch
---

`analyze` takes linear time over text holding many isolate initiators with no closing `PDI`, where 50,000 of them used to stall it for seconds.

<!-- entry: fix perf -->
