---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: with an `object` pref and one of its own fields both selected, picking a kind now converts the object. It threw and changed nothing, since converting the object first removed the field the next step looked for.
