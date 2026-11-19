---
'@weasel-js/bidi': patch
---

`analyze` handles a paragraph whose text sits at one level for hundreds of thousands of characters, rather than throwing a `RangeError`.

<!-- entry: fix -->
