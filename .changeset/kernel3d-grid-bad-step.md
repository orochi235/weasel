---
'@weasel-js/kernel3d': patch
---

`groundGridSource` offers no targets when its `step` is zero, negative or not finite. A step of 0 used to offer grid lines at `NaN`.
