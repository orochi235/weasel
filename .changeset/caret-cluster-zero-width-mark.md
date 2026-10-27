---
'@weasel-js/text': patch
---

`caretIndexAt` no longer stretches a letter and its zero-width combining mark one unit into a kerned glyph after them. The mark sits where the letter's glyph ends, before the kerning pulls the next glyph back, so the cluster spanned past its own cell and its midpoint moved right by half the kern.
