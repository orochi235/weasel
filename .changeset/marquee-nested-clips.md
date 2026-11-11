---
"@weasel-js/core": patch
---

A marquee or lasso no longer selects a node its nested clipping groups hide entirely. A node under several
clips is drawn only where all of them cover, so the walk now asks an area query about the clips' common part
as well as each clip alone; before, two clips that each met the node and the marquee, but not each other, let
the marquee take a node with nothing of it on screen. `PickQuery.intersectClips` opts a query in.
