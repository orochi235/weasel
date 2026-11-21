---
'@weasel-js/theme': patch
---

A categorical ramp anchor with a negative `chroma`, or a `lightness` outside 0 to 1, is reported as invalid, instead of drawing the opposite hue or a clipped color.

<!-- entry: fix -->
