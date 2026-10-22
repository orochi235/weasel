---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

Add `resolveFill` and `resolveStroke`, the one answer to what a fill or stroke field paints: absent, `null` and a record with no `paint` are none, a paint with alpha 0 is still a paint, and `INHERIT` (`'inherit'`) takes whatever the caller passes as inherited. `fillHasInk` and `strokeHasInk` now go through them, so `fillHasInk({ paint: null })` is `false` where it used to be `true`.
