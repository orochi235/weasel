---
'@weasel-js/svg': patch
---

`serializeSvg` writes a marker whose registry key an attribute or `url(#…)` cannot hold as written (a key with a space, a quote, `&`, `<`, a bracket or `#`) under a safe id of its own, with the key kept in `wzl:key` for `parseSvg` to read back. It used to write the key as the `<marker id>` and in `url(#…)` unescaped, so such a key produced a document no XML parser accepts, or a reference nothing resolves.
