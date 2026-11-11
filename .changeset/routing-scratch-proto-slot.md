---
'@weasel-js/routing': patch
---

`setScratch` writes a slot named `__proto__` as the store's own property. It set the store's prototype instead, so
`getScratch` read nothing back and a `null` value left the store with no prototype at all.
