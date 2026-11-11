---
"@weasel-js/guides": patch
---

Equal spacing marks only a gap the box really has. `matchSpacing` drops an axis's snap when the other axis's snap carries the box away from the neighbor that set it, and no placement is offered across a gap another box blocks, a sibling the box overlaps included. `equalGaps` returns nothing when the box has no gap of the size asked.
