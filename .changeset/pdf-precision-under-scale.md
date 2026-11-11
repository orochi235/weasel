---
"@weasel-js/pdf": patch
---

Numbers in a page are written as finely as the transforms around them need. A group scaled far down was written as a
singular matrix and drew nothing; now each matrix keeps four decimals of each axis's own scale, and coordinates,
dashes, and gradient geometry under a group scaled up keep their position to 1e-4 of a page unit. A texture tile
far smaller or larger than a unit is written as a unit tile its pattern matrix scales, so it no longer collapses to
an empty tile or writes an exponent PDF cannot read.
