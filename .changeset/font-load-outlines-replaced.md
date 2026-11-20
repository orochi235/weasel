---
'@weasel-js/font': patch
---

`loadFontOutlines` and `fontEmbedding` answer for the face registered when its load settles, not one replaced while it loaded.

A PDF export no longer loses a face's embedded font to a re-registration during the load.

<!-- entry: fix -->
