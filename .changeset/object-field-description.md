---
'@weasel-js/ui': patch
---

A field of an object leaf in `PrefsForm` never showed its `description`: the field's row had no help cue, where a leaf's own row has one. The field's row now offers it.
