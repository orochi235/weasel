---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Draw the close X at the size of the glyphs around it.

Its arms spanned 5–15 of the 20×20 box while every neighbour spans about 3–17,
so at the same `size` it read as a smaller icon. The arms now reach 3.4–16.6 at
a 1.9 stroke, and labkit's title-bar region draws its glyphs at 16 like the
toolbar and palette regions rather than 14.
