---
'@weasel-js/text': patch
---

A run grammar marker whose `repeat` is not a positive integer throws a clear error from `markdownToRuns` and `runsToMarkdown`, rather than hanging.

<!-- entry: fix -->
