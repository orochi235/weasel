---
'@weasel-js/geom': patch
---

The marker builders keep their shape far from 0.

`circlePath`, `squarePath`, `rectMarkerPath`, and `roundRectPath` measure their coordinates from an origin of their own, as `PathBuilder.autoOrigin` does.

<!-- entry: fix visual -->
