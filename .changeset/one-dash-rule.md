---
'@weasel-js/core': patch
'@weasel-js/pdf': patch
'@weasel-js/svg': patch
---

SVG export and PDF read a stroke's `dash` through `dashPattern`, the rule the canvas uses, so the three draw the same thing:

- `serializeSvg` strokes solid a dash too fine for its path's whole, untrimmed length, and an all-zero or negative one, where it used to write the `stroke-dasharray` as given. A leaf whose group's dash it would otherwise inherit states `stroke-dasharray="none"`.
- A dash with a non-finite entry draws no line in either writer, and its marker heads still draw. The PDF writer used to drop the whole path, its fill included, and report a skip. `serializeSvg` used to write NaN as `0`, a solid line. A text run's stroke with such a dash draws nothing.

`dashPattern` is now exported from `@weasel-js/core` as well as `@weasel-js/paint`.
