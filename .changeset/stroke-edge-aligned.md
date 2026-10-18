---
'@weasel-js/stroke': patch
---

`strokeEdgeNear` measures an inner- or outer-aligned stroke to the edge it
draws: the one on its side of the path's fill, twice as far from the path as a
centered stroke's, with `factor` doubled to match. The Girth tool used to grab
such a stroke off its drawn edge.
