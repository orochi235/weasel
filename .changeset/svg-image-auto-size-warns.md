---
'@weasel-js/svg': patch
---

Parsing an `<image>` whose `width` or `height` is absent or `auto` warns that it reads as 0. The reader does not decode the bitmap for its own size.

<!-- entry: fix -->
