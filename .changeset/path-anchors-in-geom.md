---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

geom: the path anchor model and the small shape builders live here now. That is `pathToAnchors`, `anchorsToPath`, `countPathAnchors`, `isAnchorSmooth`, `nearestSegmentT`, and the `PenAnchor` type, plus `circlePath`, `squarePath`, `rectMarkerPath`, and `roundRectPath`. `@weasel-js/core` still exports every one of them. New from geom: `segmentEnds` and `isStraightSegment`.
