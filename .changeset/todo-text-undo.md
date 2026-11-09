---
'@weasel-js/core': patch
---

A text box or sticky note inserted and typed into is one undo entry.

- The `insert` dep commits an empty node of a text kind (`text`, `sticky`) inside a `scene.batch` keyed with `textEditJoin(id)`, so the first edit's commit joins the insert's entry and one undo takes the node and its text together. This covers the text tool's drag and the sticky tool's drag and click. A text node inserted with its text, as a paste makes one, stays an entry of its own. An adapter whose `applyOps` keeps its own history is unaffected.
