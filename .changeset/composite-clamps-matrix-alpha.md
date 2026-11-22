---
'@weasel-js/renderer': patch
---

A `colorMatrix` pushing alpha outside 0 to 1 draws an isolated group the same color as a group drawn in place. Groups with `effects` or a `composite` are isolated too.

<!-- entry: fix visual -->
