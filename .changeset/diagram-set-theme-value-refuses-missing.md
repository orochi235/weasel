---
'@weasel-js/diagram': patch
---

`setThemeValue` throws a `RangeError` for a role, lane body or series color the theme does not have.

It had returned a theme with a partial role or holes in an array. Appending one color at the end of `series` still works; make a role with `addThemeRole`.

<!-- entry: fix -->
