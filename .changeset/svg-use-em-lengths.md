---
'@weasel-js/svg': patch
---

Importing SVG reads an `em` or `ex` length on a shape, image, or text drawn by a `<use>` against the font size the `<use>` gives it, as browsers do.

<!-- entry: fix visual -->
