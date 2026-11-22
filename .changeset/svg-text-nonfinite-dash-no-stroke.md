---
'@weasel-js/svg': patch
---

SVG export writes a text run whose dash has a non-finite entry unstroked, as the canvas draws it. The same goes for a text inheriting such a stroke from its group.

<!-- entry: fix visual -->
