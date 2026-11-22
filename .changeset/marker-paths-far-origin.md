---
'@weasel-js/geom': patch
---

`circlePath`, `squarePath`, `rectMarkerPath`, and `roundRectPath` keep their shape far from 0, measuring their coordinates from an origin of their own as `PathBuilder.autoOrigin` does.

<!-- entry: fix visual -->
