---
"@weasel-js/labkit": patch
---

An orbit trial's zoom readout and resize check honor the instrument's own `orbit.limits` rather than the default ones. A camera dollied past 500 units under a wider `maxDistance` reads its real zoom and keeps its place.

<!-- entry: fix -->
