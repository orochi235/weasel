---
'@weasel-js/geom': patch
'@weasel-js/stroke': patch
---

A trimmed stroke with a `nib`, or with per-vertex widths under a stretching metric, is cut where the same trim cuts a plain stroke.

`polylineAtCurve` counts a corner split into two coincident points as one anchor.

<!-- entry: fix visual -->
