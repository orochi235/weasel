---
'@weasel-js/svg': patch
---

SVG import places a `<text>`'s box by where its first glyph lands, not by the `<text>`'s own `y`. A `<tspan>` with its own `x` and `y` that opens a `<text>` with no `y` used to put the box top a line above `y="0"`: `<text><tspan x="10" y="20">A</tspan></text>` now gets its top at 4, not -16.

Another writer's `dy` on `<text>` now moves the first glyph, as SVG says, where it used to be dropped without a warning. Text weasel wrote, which puts the half leading in that `dy`, is told apart by its `data-weasel-width`, and its `dy` stays unread.
