---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

`prefObjectWithField` and `prefObjectBase` in `@weasel-js/prefs` are the one rule for writing a field of an `object` leaf, which `PrefsForm` and `SelectionPanel` each wrote their own way. Where no object is held, the write starts from the scalar lifted by `fromScalar`, else from the leaf's `default`, so the value is whole. `PrefsForm` used to start from an empty object there, and wrote one field on its own.
