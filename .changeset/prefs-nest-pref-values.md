---
'@weasel-js/prefs': minor
---

`nestPrefValues` turns values keyed by dotted path, as `PrefsBar` and `BarMenu` take them, into the nested tree `PrefsForm` reads.

It writes every key as the tree's own, so a path through `__proto__` or `constructor` lands in the tree and never on a prototype. It is the inverse of `flattenPrefValues`.

<!-- entry: api -->
