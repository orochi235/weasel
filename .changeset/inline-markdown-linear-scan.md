---
'@weasel-js/ui': patch
---

`parseInline` and `InlineMarkdown` read a line in time linear in its length, even a run of 20,000 `[` that never close.

<!-- entry: perf -->
