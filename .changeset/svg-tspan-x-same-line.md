---
'@weasel-js/svg': patch
---

Importing SVG places a `<tspan>` with its own `x` on the current line where the `x` says. It warns where no loaded face can measure the gap.

<!-- entry: fix visual -->
