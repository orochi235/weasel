---
"@weasel-js/menu": patch
---

`inTriangle` no longer counts a point as inside a triangle flattened to a segment or a point when it lies on that line past its ends, so a submenu's diagonal allowance no longer holds for a pointer moving away along the line.
