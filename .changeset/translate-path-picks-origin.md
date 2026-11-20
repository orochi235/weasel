---
'@weasel-js/geom': patch
---

`translatePath` gives a polygon with no origin one when the move takes it far from 0, as `transformPath` does, so a shape dragged far out keeps its precision.

<!-- entry: fix -->
