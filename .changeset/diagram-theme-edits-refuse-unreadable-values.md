---
"@weasel-js/diagram": patch
---

`setThemeValue`, `addThemeRole` and `renameThemeRole` throw a `RangeError` on a value the theme checker refuses, such as a font size of 0, a color it cannot parse, or an empty role name, rather than return a theme a document saving it would read back as `night`.

<!-- entry: fix behavior -->
