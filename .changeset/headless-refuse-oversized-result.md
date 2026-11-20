---
'@weasel-js/headless': minor
---

The raster host refuses a render past `MAX_RESULT_BYTES`, about 10 000 × 10 000 RGBA pixels, naming the limit.

An RGBA render is refused before a browser starts; a PNG once the page has encoded it.

<!-- entry: fix api -->
