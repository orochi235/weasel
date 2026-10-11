---
'@weasel-js/core': patch
---

`useTextEdit` writes nothing when an edit closes with the text, the runs, and the node's style as it opened: neither `setText`, `setRuns`, nor `commit` is called. An open-and-close no longer strips a trailing newline from the node's text, and `useSceneTextEdit` relies on the same rule in place of its own comparison.
