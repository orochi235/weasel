---
'@weasel-js/geom': patch
---

A puppet warp that folds spends fewer rounds polishing once nothing is turned over. Past that point the
injective pass scales each step to the curvature the last one saw, so a step now runs its full length
where the line search used to halve nearly every one, and it stops once a round takes off less than 0.3%
of the energy above a rigid motion, where it compared against the whole energy. The bar pushed into an S
takes 34 rounds where it took 41; the squashed disc takes 19 where it took 18. Its result moves slightly,
so a refit of the warped outline can land on a different number of anchors.
