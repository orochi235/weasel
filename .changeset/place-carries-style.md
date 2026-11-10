---
'@weasel-js/core': patch
---

A click-to-place insert (`placeAction`) hands the style params it runs with to the `insert` dep as `extras.style`, as a drag insert does, so a tool whose fill or stroke options tune `place` paints the shape it places with them rather than the next palette color.
