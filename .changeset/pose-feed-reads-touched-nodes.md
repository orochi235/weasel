---
'@weasel-js/core': patch
---

`createPoseFeed` reads only the nodes an edit touched, rather than walking the whole scene on every read after a change.

<!-- entry: perf -->
