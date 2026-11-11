---
"@weasel-js/text": patch
---

`textClusters` returns clusters in the line's visual order and opens the first slot at the line's start, even under tight letter spacing.

A cluster whose tracking pulls the next one back reports a negative `advance`.

<!-- entry: fix -->
