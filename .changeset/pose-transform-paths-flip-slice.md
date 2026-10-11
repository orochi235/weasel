---
'@weasel-js/core': patch
---

`pathInWorld`, `worldEditToStorage`, and `textToPath` place geometry through a pose's `transform` as well as its rotation, so anchor edits, slices, and text outlines of a skewed or stretched node land where it is drawn. Slicing keeps the transform on the pieces, and flipping a node mirrors its transform along with its rotation. `PathInWorldPose` gains the optional `transform` field.
