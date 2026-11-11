---
"@weasel-js/storage": patch
---

The JSON storage adapters no longer warn about a plain object from another realm, such as an iframe's or one `structuredClone` built.

`localStorageAdapter`, `sessionStorageAdapter` and `urlHashAdapter` now warn about an array whose hole sits beside an extra key, which JSON changes.

<!-- entry: fix -->
