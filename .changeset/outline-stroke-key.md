---
'@weasel-js/renderer': patch
---

Outlined text keys its glyph stroke ribbons on the stroke's `nib`, `trim`, `vertexWidths` and `varyingWidthJoinThreshold`. They were left out, so two runs stroking the same glyph at the same width shared whichever ribbon was built first: a calligraphic outline could draw with a round pen, or a trimmed one whole.
