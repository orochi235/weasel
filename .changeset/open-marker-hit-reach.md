---
"@weasel-js/core": patch
---

A path node's grab reach now covers the full painted extent of its marker heads, the same measure culling uses. Before, it grew only by each head's inset, so `arrow-open` and `bar` — which inset nothing — painted arms outside the clickable band.
