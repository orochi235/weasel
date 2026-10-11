---
'@weasel-js/svg': patch
---

`parseSvg` reads a cropped image whose group transform mirrors it and whose inner `<image>` is flipped on the same axis as not flipped; it used to keep the flip.
