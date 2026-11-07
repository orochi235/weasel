---
'@weasel-js/guides': patch
---

`alignmentSnapSource`'s `page` box is carried into the parallax plane a gesture runs in, as ruler guides and the grid already are. A node on a parallax layer used to align to the page's edges and center where they would lie in the camera's world, not where the page is drawn under it.
