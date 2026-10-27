---
'@weasel-js/svg': patch
---

SVG import reads a `dx`, `x`, `dy`, `y` or `rotate` list over white space that `xml:space="preserve"` keeps. Before, it reported such a list as moved by collapsing white space and left it unread, though under `preserve` nothing collapses and every character stays one glyph.
