---
'@weasel-js/font': patch
'@weasel-js/text': patch
'@weasel-js/text-shaping': patch
'@weasel-js/pdf': patch
---

A baked atlas or canvas face is now shaped when its font file is registered too: call
`registerFontOutlines` for the same family and variant beside `registerFont` or `registerCanvasFont`,
and a registered shaper reads that file. A letter the shaping leaves as its own glyph still draws from
the atlas. A shaped cluster (a Devanagari conjunct, an Arabic joining form, a placed mark) draws from
its outline, and on a canvas face below the outline size from one tile the canvas tier bakes from that
outline (`DynamicFace.requestShaped`). A baked atlas must be cut from the same file, or its advances
disagree with the shaper's. PDF export writes such text as the shaped glyphs, where it used to leave
the clusters out.

A bracket that gives up its shaped glyph on an atlas face now draws its own glyph rather than nothing.
