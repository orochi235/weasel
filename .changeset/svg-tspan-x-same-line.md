---
'@weasel-js/svg': patch
---

Importing SVG places a `<tspan>` with its own `x` that stays on the current line where the `x` says, by reading the gap as letter spacing, and warns where no loaded face can measure it.

<!-- entry: fix visual -->
