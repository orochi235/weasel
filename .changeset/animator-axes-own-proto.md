---
"@weasel-js/animator": patch
---

`axesOf` keeps a plain object's own `__proto__` field, as `JSON.parse` makes one, when it builds a value back from its axes.

<!-- entry: rank=-5 fix -->
