---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s attributes pane edits an object attribute of a custom kind across several selected leaves that disagree on it. Each field shows its value where the leaves agree and as mixed where they do not, and an edit to one field is written into every leaf's own object, leaving its other fields as they were. Before, the attribute was listed as `mixed` with no control. A list, a map, or a union attribute that disagrees is still listed.
