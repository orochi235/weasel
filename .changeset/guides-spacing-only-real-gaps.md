---
"@weasel-js/guides": patch
---

Equal spacing marks and snaps only to a gap the box really has. `matchSpacing` drops an axis's snap when the other axis's snap carries the box away from the neighbor that set it, and offers no placement across a gap another box blocks, a sibling the box overlaps included. `equalGaps` returns nothing when the box has no gap of the size asked.

<!-- entry: fix visual -->
