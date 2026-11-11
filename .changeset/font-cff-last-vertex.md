---
"@weasel-js/font": patch
---

A glyph from a CFF (`.otf`) face keeps every vertex of its outline. TrueType outlines now keep the line back to each contour's start before the closing `Z`, which draws the same.

<!-- entry: fix visual data -->
