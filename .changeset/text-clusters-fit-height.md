---
'@weasel-js/text': minor
'@weasel-js/text-tools': patch
---

`textClusters` takes a `height`, so a shrink-fitted text node on a path effect lays its glyphs at the size it draws at.

Without a `height`, a shrink-fitted node shrinks to its `width` alone.

<!-- entry: fix api visual -->
