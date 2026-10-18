---
'@weasel-js/geom': patch
---

`pathFacePieces` and `pathDividePieces` trace the arrangement of the paths' outlines once instead of clipping one region per subset of the paths, so the Shape builder stays quick with a dozen or more paths selected: sixteen overlapping circles cut into 241 faces in about 20 ms, where eight took two seconds before. The faces are the same. A region's parts now come left to right rather than in the order the clipper gave them, and `pathDividePieces` no longer warns against more than about eight inputs.
