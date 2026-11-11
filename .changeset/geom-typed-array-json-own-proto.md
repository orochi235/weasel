---
"@weasel-js/geom": patch
---

`tagTypedArrays` and `reviveTypedArrays` copy an object's own `__proto__` field as a field. An animator clip's key value keeps it through `bindClip`.

<!-- entry: rank=-5 fix -->
