---
'@weasel-js/renderer': patch
---

A gradient switched to a mesh keeps the padded ends outside its first and last stop. A hard break or a single stop at 1 no longer becomes an empty mesh, and switching back keeps the stops in place.

<!-- entry: fix visual -->
