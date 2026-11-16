---
'@weasel-js/diagram-formats': patch
---

The DOT writer writes stroke widths, places and sizes in plain digits, never an exponent, so a tiny or huge one reads back.

<!-- entry: fix -->
