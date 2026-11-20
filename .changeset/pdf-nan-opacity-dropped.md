---
'@weasel-js/pdf': patch
---

`writePdf` drops and reports an image, sprites, isolated group or gradient whose opacity is not finite, rather than drawing it opaque.

<!-- entry: fix -->
