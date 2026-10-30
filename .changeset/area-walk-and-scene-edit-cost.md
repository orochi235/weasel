---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

`NodeGates.hidden` and `NodeGates.locked` take the node itself as well as its id, and answer the same for
either; a walk that already holds the node saves looking it up. The pick walk now hands them its
candidates, decides a marquee from a node's bounds before building anything to test its outline, and no
longer allocates per candidate. Scene edits and history pushes allocate less per op. No result changes.
