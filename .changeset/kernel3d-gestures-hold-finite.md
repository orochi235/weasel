---
"@weasel-js/kernel3d": patch
---

`orbitBy`, `dollyBy`, `panBy` and `dollyToward` leave the camera as it is for an input that is `NaN` or would carry it past the double range.

<!-- entry: fix -->
