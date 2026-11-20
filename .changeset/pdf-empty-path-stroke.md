---
'@weasel-js/pdf': patch
---

`writePdf` writes no stroke for a path with no commands, such as an empty polyline, so strict PDF readers no longer report its page as broken.

<!-- entry: fix -->
