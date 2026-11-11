---
"@weasel-js/ui": patch
---

A menu bar keeps a loose setting keyed `__proto__` in its run instead of losing it. The schema editor's copies, moves, key checks, action catalog, and bundle tree, and the attribute panel's shared values, set keys as own keys throughout, so a key named `__proto__` in a schema made elsewhere is neither lost nor left unrenamed beside another.
