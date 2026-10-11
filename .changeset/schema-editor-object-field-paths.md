---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`, over a node property schema, follows a renamed or moved field of an `object` pref by its whole path. It took the field's own key for the path, so renaming `stroke`'s `width` left a condition on `stroke.width` behind and rewrote one that read a pref keyed `width`.
