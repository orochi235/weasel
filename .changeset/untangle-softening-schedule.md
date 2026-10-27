---
'@weasel-js/geom': patch
---

A puppet warp that folds untangles in fewer rounds when its bend is long. The injective pass shrinks its
softening at least 20% a round while some triangle is turned over, and at least 5% once none is, where it
shrank 10% throughout. The bar pushed into an S takes 41 rounds where it took 45; the squashed disc takes
18 where it took 17. Its result moves slightly, so a refit of the warped outline can land on a different
number of anchors.
