---
'@weasel-js/prefs-schema': patch
---

`prefDisplayBounds` orders the bounds of a decreasing unit that has no finite value at stored 0 or 1, such as a log over an offset range, low end first, and flips `endless` and `stops` to match.

<!-- entry: fix -->
