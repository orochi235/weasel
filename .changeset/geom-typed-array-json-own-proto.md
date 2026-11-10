---
"@weasel-js/geom": patch
---

`tagTypedArrays` and `reviveTypedArrays` copy an object's own `__proto__` field, as `JSON.parse` makes one, as a field. The copy set its prototype to the field's value instead, so the field went missing from it and from its JSON; an animator clip's key value lost it through `bindClip`.
