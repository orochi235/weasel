---
'@weasel-js/core': patch
'@weasel-js/paint': patch
---

`DEFAULT_PALETTE` is now a `Palette` of five named sRGB entries rather than a `string[]`, which breaks any code indexing it as an array. `cycleFill(seq, palette?, fallback?)` gives the `seq`th entry as hex, wrapping, and is what the built-in shape tools and the `insert` dep now call. `@weasel-js/paint` gains `hexToColorLiteral` for `#rrggbb` and `#rrggbbaa`.
