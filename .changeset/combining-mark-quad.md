---
'@weasel-js/text': patch
'@weasel-js/core': patch
---

Fixes: a combining mark was never drawn from an atlas. A glyph with a rect and no advance, which is what a combining accent is, was given no quad, so `e` followed by U+0301 painted a bare `e`. It is drawn now, where its offsets put it.
