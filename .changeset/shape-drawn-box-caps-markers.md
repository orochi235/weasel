---
"@weasel-js/core": patch
---

A rect's or an ellipse's drawn box, which selection chrome and alignment read, now holds what sticks out of
its stroke: square caps on the ends a dash or a trim opens, whose corners stand off a curve by up to √2
half-widths, and marker heads. Measured boxes flatten curves to the renderer's half-pixel tolerance at the
view's scale rather than to half a world unit.
