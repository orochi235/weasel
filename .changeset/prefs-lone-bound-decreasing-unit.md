---
"@weasel-js/prefs": patch
---

`prefDisplayBounds` now moves a lone `min` or `max` to the other end under a unit whose conversion decreases, as it already did for `endless` and for a leaf with both bounds.
