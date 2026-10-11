---
'@weasel-js/svg': patch
---

`parseSvg` dropped a `<text>` or `<image>` element's own `transform` unless it was a rotation about the box center, so `<text transform="translate(100 50)">` imported at x = 0 with no warning. The box now moves, scales, and rotates with the transform; a uniform scale reaches the text's font size, letter spacing, and stroke, an image stretches and flips, and a skew or a non-uniform scale on text keeps what the node can hold and warns.
