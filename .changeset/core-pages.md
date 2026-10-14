---
'@weasel-js/core': patch
---

Additive: a document's pages as geometry. `layoutPages` places a list of `Page`s in one world space, in a row or a column; `pageAt` and `pageOfBounds` answer which page a point or an object is on; `pagesBounds` is the box around all of them; `adjacentPage` steps the page order, for a next-slide move; `pagesLayer` is a world-space render layer that paints each sheet; and `fitViewToPage` is the view that frames one.
