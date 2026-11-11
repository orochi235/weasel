---
"@weasel-js/registry": patch
---

`deepEqual` reads an array hole as `undefined`, so `[, 1]` no longer equals `[5, 1]`.

<!-- entry: rank=-5 fix -->
