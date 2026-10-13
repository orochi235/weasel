---
'@weasel-js/svg': patch
---

Fixes: `parseSvg` gave text written as one `<tspan>` per line the default 1.2 line height whatever pitch the lines stated. The pitch, from each line's `dy` or the step between its `y` and the last, is now read as the node's `style.lineHeight`, a multiple of its font size, and sizes the box. Lines at the default pitch leave it unset, as before. Lines pitched unevenly take their mean, which keeps the block's height, with a warning; taking the mean was an agent's judgment.
