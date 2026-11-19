---
'@weasel-js/core': patch
---

Pasting malformed weasel clipboard text pastes nothing, with a debug warning, rather than throwing or adding nodes the scene cannot save.

That covers an item that is not a node, a duplicate id, a layer the scene lacks, a pose with no finite bounds, and parents that loop.

<!-- entry: fix -->
