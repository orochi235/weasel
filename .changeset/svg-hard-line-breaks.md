---
'@weasel-js/svg': patch
---

`serializeSvg` writes a hard line break in a text node as a line of its own. Each line after the first is a `<tspan>` sent back to the anchor point by `x` and down by `dy`, at the node's font size times its line height, so a reader other than weasel draws the lines where it used to draw one line with a space at each break. A blank line is folded into the next line's `dy`, which carries `data-weasel-lines` so `parseSvg` reads the blank lines back.

Breaking: what `parseSvg` returns for text weasel wrote changes in three ways. A multi-line node comes back with `style.lineHeight` set when it is not the default 1.2, where it used to come back without one. A line that opens in the style the previous line closed in continues that run, so `<tspan>` lines of one style read back as one run holding the breaks rather than a run per line. A break that ended a run is read back at the start of the next run, and an empty run is no longer written.
