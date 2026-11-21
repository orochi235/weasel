---
'@weasel-js/ui': patch
---

`TokenPanel` sorts its tokens into sections in time linear in their count, where a large theme used to cost a quadratic copy on every change.

<!-- entry: perf -->
