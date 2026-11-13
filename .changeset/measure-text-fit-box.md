---
'@weasel-js/text': minor
'@weasel-js/core': minor
---

`measureTextBounds` can measure text at the size it shrinks to in a box.

`measureTextBounds(text, style, { fitBox: { width, height } })` measures the text at the size a node with `fit: 'shrink'` sets it at in a box that size, wrapping at `maxWidth`.

<!-- entry: api -->
