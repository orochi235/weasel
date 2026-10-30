---
'@weasel-js/pdf': patch
---

A shaped cluster's glyphs that stand for no text of their own (an Arabic letter's dotless body, the consonant under a Devanagari i-matra) now map to U+2060 WORD JOINER in `/ToUnicode`, and the glyph after one is placed with `Td`. pdf.js, which ignores `/ActualText`, read such a glyph as a control character (`بت` came back as `\u0007ت ب`) and now reads `تب`; readers that honor `/ActualText` read the same text as before.
