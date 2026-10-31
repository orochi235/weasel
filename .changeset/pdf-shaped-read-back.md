---
'@weasel-js/pdf': patch
'@weasel-js/text': patch
---

Shaped text in an exported PDF reads back as written in pdf.js and poppler more often. A glyph drawn for
two different texts (the ka under a Devanagari i-matra and a lone ka) now takes a separate code for
each, mapped to the same glyph, so `/ToUnicode` reads `किक` back as `किक` rather than `किकक`. A
cluster's text goes on its widest glyph, a mark the shaper gave no advance moves the pen nowhere, and a
right-to-left cluster's glyphs that stand for no text are drawn after the rest of the line in one span,
so pdf.js keeps right-to-left text in one piece and poppler no longer sets a fatha off as a word.

`ShapedCluster.glyphs` entries carry the shaper's `advance`.
