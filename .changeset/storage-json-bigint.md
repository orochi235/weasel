---
"@weasel-js/storage": patch
---

The JSON storage adapters write a `bigint` as its decimal digits, with a warning, rather than rejecting the write.

That is `localStorageAdapter`, `sessionStorageAdapter` and `urlHashAdapter`.

<!-- entry: fix -->
