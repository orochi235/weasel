---
"@weasel-js/storage": patch
---

`localStorageAdapter`, `sessionStorageAdapter`, and `urlHashAdapter` no longer warn about a plain object from another realm, such as an iframe's or one `structuredClone` built, which JSON keeps exactly. They now warn about an array whose hole sits beside an extra key, which JSON changes.
