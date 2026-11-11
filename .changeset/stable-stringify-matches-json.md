---
"@weasel-js/core": patch
---

`stableStringify` writes what `JSON.stringify` writes for every value JSON can write: a boxed `Number`, `String`, or `Boolean` is written as its value rather than as `{}`, and an object's `toJSON` is called once, with its key, rather than again on what it returns. A `toJSON` that returns its own object no longer overflows the stack.
