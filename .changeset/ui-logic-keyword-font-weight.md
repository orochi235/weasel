---
'@weasel-js/ui-logic': minor
---

A button or menu's current row measures a font-weight token of `bold` or `normal` at 700 or 400, the weight CSS draws, not the fallback.

The reader is exported as `envFontWeight(env, name, fallback)`: it also falls back on `bolder`, `lighter`, and a weight outside 1–1000.

<!-- entry: fix api -->
