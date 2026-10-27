---
'@weasel-js/geom': patch
---

A puppet warp that folds untangles in fewer rounds. The injective pass now steps along a limited-memory
BFGS direction built over the same edge system, and stops after two settled rounds in a row instead of
one. The squashed disc in the fold tests takes 17 rounds where it took 28, and the bar pushed into an S
45 where it took 51, each ending at a lower untangling energy than before. Time per solve: the disc
went from 5.0 ms to 4.1 ms; the bar from 6.2 ms to 6.7 ms, since each round costs more.
