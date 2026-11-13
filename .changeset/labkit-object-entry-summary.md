---
'@weasel-js/labkit': minor
---

A list or map of objects names each entry on its row by its first string field, or a union by its tag, not as JSON.

`.summary((value) => string)` on an `f.object` or `f.union` supplies the text instead: `f.object({ name: f.string(''), width: f.number(1) }).summary((v) => `${v.name} ${v.width}`)`.

<!-- entry: api fix -->
