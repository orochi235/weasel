---
'@weasel-js/geom': patch
---

`@weasel-js/geom/booleans` exports `pathFaceArrangement(paths, { tolerance })`: the faces paths' outlines cut the plane into, each one connected region with its holes, naming the inputs that cover it, with curved edges kept as pieces of the input curves. It also lists which faces share edges and how long a stretch, with `-1` for the side no input covers. It cuts and traces the arrangement on a fine flattening, so curves that touch or run nearly along each other (glyph tops and bottoms tangent to one line, say) no longer drop it to polylines, and there is no segment ceiling: Inter's 94 printable ASCII glyphs overlaid in one cell give 41,517 curved faces in 0.77 s on an M5 Max.

`pathFacePieces` is now `pathFaceArrangement`'s faces, and `pathDividePieces` groups those faces by cover. Both keep curves for any input rather than falling back to the flattened clipper, and a path whose own contours overlap is one face rather than several. Where two curves cross cleanly, the crossing point is the curves' own intersection. Where they meet nearly tangent it comes from the flattening instead, cut at `tolerance` (by default a hundred-thousandth of the inputs' extent).

Curve booleans now cut a cubic that crosses itself where it does, instead of handing the whole operation to the flattened clipper, and their outline cut finds candidate pairs by a sweep rather than testing every pair. `intersectSegments` takes an optional `maxHits`.
