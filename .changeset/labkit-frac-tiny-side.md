---
"@weasel-js/labkit": patch
---

A mark's position and shape read as 0 along a side too short to divide by, as they already did along a side of no length. A content box or a mark's bounds a hair over zero wide stored `NaN` or `Infinity` there.
