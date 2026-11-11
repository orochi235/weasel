---
"@weasel-js/stroke": patch
---

A `{ px }` stroke's per-vertex widths draw at their true size under a transform that stretches one axis more than the other.

`populatePolylineWidths` given a `scale` splits each corner into two coincident points, one per edge, as a nib already does.

<!-- entry: fix visual -->
