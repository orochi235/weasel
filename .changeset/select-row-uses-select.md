---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

`SelectRow` renders weasel-ui's `Select` rather than a native `<select>`, so a
property row's dropdown opens the same listbox as every other weasel select. Its
props are unchanged: an unchosen or unknown value still shows the placeholder. Code
that drove the row as a native select — `selectOption`, or a `change` event on it —
now opens the trigger and picks an option instead.

`Select` gains `variant: 'bare'`, which drops the box for a select set in other
chrome, and reads its value alignment from `--wzl-select-align`. An inline property
row sets that to `right`, keeping its values against the chevron.

labkit's config panels and forge's trial Settings pick up the change through
`SelectRow`.
