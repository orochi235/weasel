---
'@weasel-js/ui': patch
---

`PrefsForm` and `SelectionPanel` walk an object leaf's children with one walker, each handing it the parts it draws its own way: how a field's value is read, how a run of fields becomes rows, and how a section is framed. Two things change in a form: a section nested in a `bar` section is set apart by a divider on each side, as a bar and the panel already drew it, where its fields ran in with their neighbors; and a section with no name draws no empty heading.
