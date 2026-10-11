---
'@weasel-js/prefs': patch
---

Pref paths no longer walk the prototype chain. A schema group keyed `constructor` made `createPrefsStore` write its leaves onto the global `Object` (and throw from every read when a leaf was keyed `name`), a key or stored record named `__proto__` replaced a prototype instead of setting a value, and `prefValueAtPath` returned an inherited function for a path like `toString`, so `flattenPrefValues` reported values a tree never held. `prefValueAtPath` and `assignPrefValueAtPath` now read and write own properties only, and so do `store.values()` and `store.stored()`.
