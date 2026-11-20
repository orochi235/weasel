---
'@weasel-js/font': patch
---

A family registered with only a 300, only a 700 or only an italic face draws in its nearest face, not in another family.

The outline tier and `registerCanvasFont` still serve the request first when either has the family.

<!-- entry: fix visual -->
