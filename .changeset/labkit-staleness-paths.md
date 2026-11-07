---
'@weasel-js/labkit': patch
---

A mark's staleness reads each `positionDependsOn` key as a dotted config path, so a value nested under an `f.group` is checked, and compares values by their contents, so a list or object value no longer reads as stale after a reload.
