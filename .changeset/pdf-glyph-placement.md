---
'@weasel-js/text': patch
'@weasel-js/pdf': patch
---

`@weasel-js/text` exports `glyphOutlineAt(d, glyph, dx, dy)`, which sets a glyph's em-space outline data where the
renderer's outline tier draws it: wound positive, grown for synthetic bold, and sheared for synthetic italic.
`textToPath` and `textClusters` already placed glyphs this way. `@weasel-js/pdf` now does too, so a glyph it draws
as an outline is wound positive whichever way its face winds it, and glyphs from faces that disagree on winding fill
where they overlap under nonzero, as they do on the canvas.
