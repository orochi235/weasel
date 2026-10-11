---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` follows and checks the conditions inside a union's variants. A `showIf` or `enableIf` on a variant, or on a field inside one, now follows a pref that is renamed or moved, and a bad one marks the union's row in the structure tree. The fields inside a list's or a map's entry are checked the same way, where only the entry's own condition was.
