---
'@weasel-js/guides': patch
---

Adds API: two layout strategies for children of mixed sizes.

`quadtree({ maxDepth })` quarters its container as far as each child needs: a child holds the smallest cell that fits it, and a cell is free while it, the cells around it, and the cells inside it hold nobody. A drag is offered the free cells of its own size, an arrival with no free cell is refused, and `cells(container, children)` on the strategy reports who holds what, for an overlay.

`pack({ gap, overflow })` shelves children at their own sizes, left to right, wrapping at the container's width. A drop inserts at an index and everything after it reflows. `overflow` is `'reject'` (the default), `'grow'`, or `'scroll'`, as on `tileGrid`.

`sequenceLayout(sequencer)` is the behavior `pack` and `slots` share, exported for a layout that keeps its children in one ordered sequence of its own.

Decided on an agent's judgment: a quadtree never moves a child to make room, and places larger children first when it arranges; `pack`'s order is reading order, shelf by shelf, and it refuses a child wider than the container whatever the overflow policy.
