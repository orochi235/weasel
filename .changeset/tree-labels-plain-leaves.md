---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s trees (structure, unplaced, settings, and actions) show a node's key after its name with no parentheses and a size smaller, and set a leaf's label in the plain weight under a group's bolder one. Each row's leading glyph sits in a 16px square.

`Tree` reads `--wzl-tree-leading-size`: set, every `leading` sits centered in a square of that side, and a glyph of another shape is scaled to fit it.
