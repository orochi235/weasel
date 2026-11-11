---
"@weasel-js/hud": patch
---

A HUD menu color picker's swatch that is no hex color, such as `red`, reads checked only when it is the color the row holds. It used to read checked whenever the row held no color or one that was no hex color, since neither side could be read as hex and the two empty readings compared equal.
