---
'@weasel-js/ui': patch
---

A custom kind's attribute in `PrefSchemaEditor`'s `kinds` may say `required: true`: emptying it keeps it on the leaf, and a new leaf of the kind, or one switched to it, starts with it set to the attribute's `default`. An attribute named `default` likewise gives a new leaf its default. `KindAttr` is the attribute's type.
