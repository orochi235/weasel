---
'@weasel-js/svg': patch
---

Exporting a text run whose stroke paints nothing writes `stroke="none"` on its `<tspan>`, so it no longer takes the text node's stroke.

<!-- entry: fix visual -->
