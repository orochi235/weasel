---
"@weasel-js/pdf": patch
---

A PDF leaves out and reports an image whose host pixels, from `readPixels` or `rasterize`, are the wrong size.

The report reads `image has the wrong number of pixels`. A bitmap needs a whole number of pixels each way, at least one, and four bytes for each.

<!-- entry: fix -->
