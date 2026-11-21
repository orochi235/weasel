---
'@weasel-js/svg': patch
---

SVG import warns when it flattens a `<tspan>` nested in another into its parent's text, dropping the inner one's styling.

<!-- entry: fix -->
