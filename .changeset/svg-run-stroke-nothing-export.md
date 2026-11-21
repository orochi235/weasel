---
'@weasel-js/svg': patch
---

`serializeSvg` writes `stroke="none"` on a text run whose stroke draws nothing, such as one of zero width. Its `<tspan>` no longer takes its text's stroke.

<!-- entry: fix visual data -->
