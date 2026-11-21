---
'@weasel-js/text': patch
'@weasel-js/renderer': patch
---

`paintRuns` and `cachedPaintRuns` throw a `RangeError` when `outlineMinSize` is `NaN`; omit it to draw no outlines.

<!-- entry: fix behavior -->
