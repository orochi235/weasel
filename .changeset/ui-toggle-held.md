---
'@weasel-js/ui': minor
---

`Checkbox` and `Switch` pass `onChange` a second argument, `{ alt }`, saying whether Alt was held as the box changed.

A list of switches drawn in rows of its own, such as a table's column of checkboxes, uses it to solo on Alt-click through ui-input's `soloChanges`. A handler that takes one argument is unaffected.

<!-- entry: api -->
