---
'@weasel-js/icons': patch
---

The icon registry's `add` throws a `TypeError` for a batch holding a malformed glyph, and registers none of it.

A glyph needs a string `body` and `group` and an array of `tags`.

<!-- entry: fix -->
