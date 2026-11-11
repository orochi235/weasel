---
"@weasel-js/font": patch
---

A glyph in a CFF (`.otf`) face kept every vertex of its outline. The default outline parser let opentype.js
optimize the path data it wrote, which drops a contour's last line whenever it ends within one unit of the
contour's start; at one unit per em that was every last line, and a CFF contour, which closes implicitly, lost its
last vertex. TrueType contours now also keep the line back to their start before the closing `Z`, which draws the same.
