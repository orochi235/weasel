---
"@weasel-js/devtools": patch
---

`RegistryBrowser` picks the entry clicked even when category and entry ids contain `/`, as with category `a/b`'s entry `c` beside category `a`'s entry `b/c`.

<!-- entry: fix -->
