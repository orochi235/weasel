---
'@weasel-js/renderer': patch
---

`imageStatus` on a `bitmapSrc` name no longer counts as a read in `imageReadsDuring`, as it already did not for any other source.

<!-- entry: fix -->
