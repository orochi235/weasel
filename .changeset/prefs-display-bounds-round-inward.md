---
'@weasel-js/prefs-schema': patch
---

A number field under a unit with `places` rounds its shown `min` up and its shown `max` down, so it never stores past the leaf's bounds.

<!-- entry: fix -->
