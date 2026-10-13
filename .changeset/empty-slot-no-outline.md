---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Fixes: a character the layout had no glyph for was drawn on top of the next one once text grew past the outline threshold. With the fallback policy set to `'none'`, a code point missing from the atlas gets an empty, zero-width slot; above `outlineMinSize` the painter still asked the outline face for it and drew what it found there. An empty slot now draws nothing at any size.
