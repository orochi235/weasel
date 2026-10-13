---
'@weasel-js/geom': patch
---

Adds API: `pathDividePieces` and `pathCropPieces` in `@weasel-js/geom/booleans`, which return each result path as a `BooleanPiece` with the `sources` it came from: the indices of the inputs covering a Divide region, ascending, and the one input a Crop piece was clipped from. `pathDivide` and `pathCrop` return the same paths in the same order and are now those pieces without their sources.
