---
'@weasel-js/geom': patch
---

`pathFaceArrangement`, `pathFacePieces`, and `pathDividePieces` (and so the Divide boolean) now put each face's corners where two input curves cross cleanly on the curves' own intersection, found by Newton's method from the flattening's crossing. The faces, their covers, and their neighbors stay exactly as the flattening cut them. A crossing stays where the flattening put it when the curves meet nearly tangent, or when moving it would take it farther than the flattening could have misplaced it (2·`tolerance`/sin θ for chords meeting at angle θ) or past another crossing along either curve.
