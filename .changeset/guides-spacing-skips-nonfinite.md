---
"@weasel-js/guides": patch
---

`measureGaps`, `matchSpacing`, and `spacingSnapSource` take a box with a coordinate that is not finite for nothing. Among siblings, one with a `NaN` width changed where a move was spaced.
