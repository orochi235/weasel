---
'@weasel-js/geom': patch
---

`transformAabb` answers an infinite box when a projective matrix puts part of the box behind the eye, rather than a finite box missing most of the image.

<!-- entry: fix -->
