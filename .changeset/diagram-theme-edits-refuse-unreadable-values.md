---
"@weasel-js/diagram": patch
---

`setThemeValue`, `addThemeRole` and `renameThemeRole` throw a `RangeError` on a value the theme checker refuses. That covers a font size of 0, a color it cannot parse, and an empty role name, any of which made a document saving the theme read it back as `night`.

<!-- entry: fix behavior -->
