---
'@weasel-js/pdf': patch
'@weasel-js/text': patch
---

`writePdf` exports shaped text as the glyphs its shaper chose. Before, a shaped run was written one code point at a time, so Arabic lost its joining forms and Devanagari its conjuncts, and every code point of a cluster drew its own glyph on top of the one the cluster drew. Now each cluster's glyphs are written by glyph index where the shaper set them, a mark lifted off the baseline with `Ts`. A cluster of one glyph reads back through `/ToUnicode` as all of its code points (क्ष copies as क्ष); a cluster `/ToUnicode` cannot give back, such as a letter drawn as a body and its dots, is wrapped in `/ActualText` with its text. A face that cannot be embedded draws the shaped cluster's outline rather than each code point's.

This adds API: `ShapedCluster.text`, the text a cluster's glyphs stand for.
