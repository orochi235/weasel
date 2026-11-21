---
'@weasel-js/text': patch
---

`joiningRuns` breaks at a format character Unicode lists as non-joining, such as U+0600 or a directional isolate. The letters on either side no longer join across it.

<!-- entry: fix visual -->
