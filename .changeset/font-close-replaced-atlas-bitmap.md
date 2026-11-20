---
'@weasel-js/font': patch
---

Replacing a registered atlas closes the old atlas image, as does a fetch a later replacement overtook, freeing the memory at once.

<!-- entry: fix perf -->
