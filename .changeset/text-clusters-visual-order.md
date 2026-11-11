---
"@weasel-js/text": patch
---

`textClusters` returns clusters in the line's visual order and opens the first slot at the line's start, even when the letter spacing is tighter than a cluster's own advance. Before, it sorted clusters by pen position, which put the letter after a lone combining mark ahead of the mark. It could also start the first slot left of the line. A cluster whose tracking pulls the next one back now reports a negative `advance`.
