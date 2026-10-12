---
'@weasel-js/geom': patch
'@weasel-js/text': patch
'@weasel-js/core': patch
---

geom: the anchor-set edits live here now (`editAnchorSet`, `translateAnchorBy`, `moveHandleTo`, `insertAnchorOnSegment`, `deleteAnchorsAt`, `openSubpathAt`, `segmentAt`, `anchorsInRect`, `anchorAt`, `anchorCount`, `locateAnchor`, `flatAnchorIndex`, with `AnchorSet`, `AnchorRect`, and `SegmentHit`), beside `pathInWorld`, `pathInPoseFrame`, `worldEditToStorage`, and `PathInWorldPose`. `nearestPathAnchor`, `reverseAnchors`, and `PathAnchorHit` are exported here; they were not exports of `@weasel-js/core` before.

text: `textToPath`, `textToPathsByPaint`, `loadTextOutlines`, and `TextOutlinesError` live here now, with `TextOutlineSource`, `TextNodeSource`, `TextPaintPath`, `TextToPathOptions`, and `TextOutlinesFailure`. `SYNTHETIC_ITALIC_RADIANS`, the lean a faked italic takes, is exported here; it was not an export of `@weasel-js/core` before.

`@weasel-js/core` still exports every name it did before.
