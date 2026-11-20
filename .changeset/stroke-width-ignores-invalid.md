---
'@weasel-js/editing': patch
---

`setStrokeWidth` ignores a `width` that is negative or not a finite number, rather than writing it to the stroke.

<!-- entry: fix -->
