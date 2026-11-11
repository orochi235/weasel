---
"@weasel-js/plot": patch
---

`clipPolygon` no longer answers `NaN` corners where an edge of the polygon crosses a side of the area only far out, past the reach its ends are moved in to before clipping: an infinite corner, or a rect much longer than the area it is cut to.
