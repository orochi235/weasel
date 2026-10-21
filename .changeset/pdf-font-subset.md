---
"@weasel-js/pdf": patch
---

`writePdf` embeds each TrueType face as a subset holding only the glyphs the document draws, plus
`.notdef` and the components of any composite glyph, under a tagged name (`ABCDEF+Inter-Regular`).
A one-line page in Inter drops from about 16 KB to under 4 KB. Glyph ids are unchanged, so text
stays selectable and extractable as before. `subsetFonts: false` embeds each face whole, as earlier
releases did.
