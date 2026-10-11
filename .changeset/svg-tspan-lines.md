---
'@weasel-js/svg': patch
---

Wrapped text written the way Figma, Inkscape, and Illustrator write it, one `<tspan>` per line with its own `x` and a `dy` or a new `y`, imported through `parseSvg` as a single run-together line (`Line oneLine two`), one line tall. Each such `<tspan>` now starts a new line. A list-valued `x` or `y` on `<text>` (per-glyph positions) is still read as its first value, and now warns.
