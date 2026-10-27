---
'@weasel-js/geom': patch
---

`pathDivide`, `pathDividePieces`, `pathFacePieces`, `pathCrop`, `pathCropPieces`, `pathTrim` and `pathMerge` keep curves, as `pathUnion` and the other three booleans already did: each curve in a piece is a piece of an input curve, so a circle no other input touches comes back as its own cubics. This changes their output, which used to be straight segments only. They fall back to `polygon-clipping`, flattened, in the same cases the four booleans do. Signatures are unchanged.
