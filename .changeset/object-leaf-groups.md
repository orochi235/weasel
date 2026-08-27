---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

An object leaf's fields can be organised into groups

`ToolPrefObject.children` takes a `ToolPrefGroup` as well as a leaf. A group
heads its fields under a label and contributes nothing to the path — the same
rule group keys follow at the top level of a schema, so a field inside one is
still addressed as a field of the object.

Without it, a value with many fields renders as one undifferentiated list. A
`TextStyle` is the case that needs it: its character and paragraph fields are
one value but read as two lists.
