---
'@weasel-js/core': patch
---

An annulus affordance paints the same ring a press can reach, wherever its inner rect sits.

Corners where the rect's corners fall inside the ellipse are filled, and `minBandPx` floors the band past the rect edge farthest from the ellipse's center.

<!-- entry: fix visual -->
