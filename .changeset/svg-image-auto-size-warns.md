---
'@weasel-js/svg': patch
---

Parsing an `<image>` with no `width` or `height`, or one set to `auto`, warns that it reads as 0, since the reader does not decode the bitmap for its own size.

<!-- entry: fix -->
