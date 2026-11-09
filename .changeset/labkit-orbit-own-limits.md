---
"@weasel-js/labkit": patch
---

An orbit trial's zoom readout, and the check that keeps a moved camera where it is on a resize, now read the stored camera inside the instrument's own `orbit.limits` rather than the default ones, so a camera dollied past 500 units under a wider `maxDistance` reads its real zoom and is no longer snapped back to its placement.
