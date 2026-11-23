---
'@weasel-js/renderer': patch
---

A text layer holding a command rewritten with `textCommandFromRunsInto` is culled and retained by where its new text lies, not where the old text was.

<!-- entry: fix visual -->
