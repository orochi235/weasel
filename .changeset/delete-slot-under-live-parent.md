---
'@weasel-js/core': patch
---

Undoing an `ops.delete` built from a copy of a node that has since moved puts it back in its sibling slot, not at the end of its parent's children.

<!-- entry: fix -->
