---
'@weasel-js/cursor': patch
---

When a cursor sink's `painted()` starts answering another painted-cursor state, the sink clears what it set on the old one, so a layer still drawing from it stops showing that cursor.

<!-- entry: fix -->
