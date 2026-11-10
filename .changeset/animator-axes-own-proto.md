---
"@weasel-js/animator": patch
---

`axesOf` keeps a plain object's own `__proto__` field, as `JSON.parse` makes one, when it builds a value back from its axes. It was dropped, so a clip key or a target value with that field sampled and animated without it.
