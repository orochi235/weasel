---
'@weasel-js/core': patch
---

`nodeGates` no longer allocates for a node with no parent, and remembers answers only for ancestors. A walk over a flat scene, which is every pick and marquee made after an edit, had been building a `Set` and two map entries per node to answer hidden and locked.
