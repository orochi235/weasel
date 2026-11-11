---
"@weasel-js/ui": patch
---

A key named `__proto__` in a schema made elsewhere survives the schema editor's copies, moves and key checks. The action catalog, bundle tree, attribute panel's shared values and a menu bar's loose settings keep such a key too.

<!-- entry: rank=-5 fix -->
