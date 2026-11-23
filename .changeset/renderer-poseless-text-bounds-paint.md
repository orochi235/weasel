---
'@weasel-js/renderer': patch
---

Text built with `textCommand`, `textCommandFromRuns` or `textCommandFromRunsInto` maps a `'bounds'` gradient or pattern onto its own box: its position, its `width` (or a finite `maxWidth`) and its `height`, each measured from the laid-out text where it is not given.

<!-- entry: fix visual -->
