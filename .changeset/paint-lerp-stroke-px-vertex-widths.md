---
'@weasel-js/paint': patch
---

`lerpStroke` leaves a missing `vertexWidths` entry on a `{ px }` stroke missing. That anchor keeps following the zoom rather than freezing at a world width.

<!-- entry: fix -->
