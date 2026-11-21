---
'@weasel-js/text': patch
---

A soft hyphen, ZWJ, or directional mark in right-to-left text reports the level of the character beside it.

`LaidOutCell.level` no longer reads 0 there, so a click on a wrapped right-to-left line's hyphen lands on the side it was clicked.

<!-- entry: fix -->
