---
'@weasel-js/text': patch
'@weasel-js/text-dom': patch
---

Cmd+I in the text editor sets an upright run in italic text back to italic, and sets italic text upright with `italic: false` on its runs.

`styleAtRange`, `applyStyleToRange` and `effectiveRangeStyle` keep a run's `italic: false` apart from a run that inherits, and `setFlagOverRange` lowers italic over the range alone, leaving the node's `fontStyle` as it was.

<!-- entry: fix behavior data -->
