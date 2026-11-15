---
'@weasel-js/ui': minor
---

A property row's label names its control by reference, so a label that is not a string names it too, and the row's error describes it.

A `PropertyField` no longer copies a string `label` into its control's `aria-label`; the control points at the row's label instead, and an explicit `name` still overrides it. A control of your own inside a `PropertyRow` takes the same name and error through `useFieldControl`. The font pickers now take the row's id, so a click on their label reaches them.

<!-- entry: behavior new -->
