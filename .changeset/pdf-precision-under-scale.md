---
"@weasel-js/pdf": patch
---

A PDF writes numbers as finely as the transforms around them need, so a group scaled far down or up draws where it should.

Each matrix keeps four decimals of each axis's own scale, and coordinates, dashes and gradient geometry under a group scaled up keep their position to 1e-4 of a page unit. A texture tile far smaller or larger than a unit is written as a unit tile its pattern matrix scales.

<!-- entry: fix visual -->
