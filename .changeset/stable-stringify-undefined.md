---
'@weasel-js/core': patch
---

`stableStringify` always returns a string: a value JSON writes nothing for (`undefined`, a function, a symbol) gives the bare word `undefined`.

<!-- entry: fix -->
