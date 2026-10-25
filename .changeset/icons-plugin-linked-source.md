---
'@weasel-js/icons-plugin': patch
---

In dev and vitest, a linked workspace package's glyphs now come from its source table rather than its built one, so a glyph added to a package shows up without rebuilding that package first.
