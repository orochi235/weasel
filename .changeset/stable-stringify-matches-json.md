---
"@weasel-js/core": patch
---

`stableStringify` writes what `JSON.stringify` writes for every value JSON can write.

A boxed `Number`, `String` or `Boolean` is written as its value, and `toJSON` is called once, with its key; one returning its own object no longer overflows the stack.

<!-- entry: fix -->
