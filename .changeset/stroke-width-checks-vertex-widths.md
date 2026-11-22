---
'@weasel-js/editing': patch
---

`setStrokeWidth` ignores a `vertexWidths` param that is not a list of widths of zero or more, as it ignores such a `width`. It no longer throws or writes it.

<!-- entry: fix -->
