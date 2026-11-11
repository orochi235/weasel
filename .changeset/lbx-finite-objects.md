---
"@weasel-js/p-touch": patch
---

`writeLbx` writes no object whose position, points, or pen width is not a finite number: a group transform holding `NaN` or `Infinity`, an infinite stroke width, or a scale that overflows the double range had put `NaN` and `Infinity` into the file, which reads back as nothing P-touch can place. Such a command is drawn through `rasterize` like any other the file cannot state, and `lbxObjects` placed there are skipped with a reason.
