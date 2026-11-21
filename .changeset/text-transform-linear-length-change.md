---
'@weasel-js/text': patch
---

`textTransform` stays fast on a long paragraph whose case mapping changes length. Turkish lowercase or Greek uppercase no longer takes seconds per layout query.

<!-- entry: fix perf -->
