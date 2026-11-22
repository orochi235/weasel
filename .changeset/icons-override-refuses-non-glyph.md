---
'@weasel-js/icons': patch
---

An icon registry's `override` throws a `TypeError` on a glyph without a string `body` and `group` and an array of `tags`, as `add` does.

<!-- entry: fix -->
