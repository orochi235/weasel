---
'@weasel-js/animator': patch
---

A target table row with a tween or spring behind a hold is shown by the table's own pass. Such a row was read by itself every frame, at a single target's cost, and so was one where a hold had been released over a move or a stopped animation had left something beside a hold; at 10,000 rows a tween under a hold went from about 5.6 µs a row a frame to 0.04.
