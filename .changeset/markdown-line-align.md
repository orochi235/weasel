---
'@weasel-js/text': patch
---

`createMarkdownRenderer` aligns each line of a wrapped block by the context's `textAlign`, as it already placed the block. Under `left`, `start`, `right` or `end`, a shorter line used to be centered within the block; only `center` keeps that.
