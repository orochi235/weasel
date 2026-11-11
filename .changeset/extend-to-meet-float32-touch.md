---
"@weasel-js/geom": patch
"@weasel-js/path-tools": patch
---

Extend to next path is not enabled for an end that already touches a stroke, so it no longer records an undo step that changes nothing. `extendToMeet` reports no meet from such an end.

<!-- entry: fix -->
