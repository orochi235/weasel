---
'@weasel-js/geom': patch
---

`warpPath` refits a warped path with fewer anchors. In the refit it shares with `simplifyPath`, each cubic now runs as far along the samples
as one cubic can follow within the tolerance, and when the least-squares fit falls short, a search
over its two handle lengths looks for one that holds. `warpPath` also samples more densely where
the warp bends a segment. A puppet-warped bar pushed into an S refits with 11 anchors where it took
22, and a pulled 24-segment star with 59 where it took 96. The refit costs about twice as long: the
star's goes from 1.6 ms to 3.4 ms on an M-series Mac.
