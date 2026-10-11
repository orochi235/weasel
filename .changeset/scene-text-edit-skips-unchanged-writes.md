---
'@weasel-js/core': patch
---

`useSceneTextEdit` wrote the text and runs back on every commit, so opening an edit and closing it untouched left an undo step, and doing it on a node with no text gave that node `text: ''`. A commit whose text and runs match what the node already holds now writes nothing.
