---
'@weasel-js/text': patch
---

`textClusters` remembers its result per data object: the same data, width and scale return the same array until a face or glyph changes, so text along a path no longer lays its source out again on every frame of a drag. Treat the returned array as read-only.
