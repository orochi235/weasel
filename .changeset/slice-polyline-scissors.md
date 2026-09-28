---
'@weasel-js/core': patch
---

Cuts along a polyline, and scissors. `splitPathByPolyline(path, cut)` is the knife along an open polyline: the new edges follow the cut through every bend, a loop the cut draws inside the fill is dropped, and chords that cross each other are all cut. `splitPathBySegment` is now the two-point case of it. `snipPathByPolyline(path, cut)` splits a path's stroke wherever the cut crosses it, leaving every piece open instead of closing it the way a fill does; curves keep their segment types in both. `sliceAction` takes the binding param `cut: 'freehand'` to cut along the whole drag trail rather than a straight line. Breaking: `SliceDep.commit` now receives the cut as one polyline, `commit(cut)`, instead of `commit(a, b)`; a straight cut arrives as `[a, b]`.
