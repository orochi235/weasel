---
"@weasel-js/pdf": patch
---

Text in a TrueType face the font registry loads but whose tables the PDF subsetter cannot read whole (a metric count
of 0, a glyph count past its `loca`, a glyph or composite running past its table, a kept table past the file's end)
is drawn as outlines. Such a face failed the whole file with a `RangeError`. A table the subset drops may lie
anywhere.
