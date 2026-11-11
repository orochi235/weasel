---
"@weasel-js/text-shaping": patch
---

`shape` no longer answers one request with another's cached glyphs when a NUL or a comma made their cache keys run together.

A feature setting it cannot read is refused every time.

<!-- entry: fix -->
