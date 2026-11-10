---
"@weasel-js/guides": patch
---

`deriveAlignmentGuides` gives every guide its own id. Since guides merge by tolerance rather than a rounding grid, two guides more than 0.001 apart could round to the same `align:x:…` name; the second now takes a `~2` suffix.
