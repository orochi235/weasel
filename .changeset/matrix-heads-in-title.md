---
"@weasel-js/labkit": patch
"@weasel-js/ui": patch
---

A `ControlMatrix` with a `title` draws its column headers in the panel's title row, over their columns, and a folded one draws the title alone. The table keeps a header row at no height, which still sizes the columns and names them for a screen reader. A matrix with no title keeps its headers in the table.

`PropertyPanel`'s actions take their width from `--wzl-prop-panel-actions-basis` when an ancestor sets it; unset, they size to their content as before.
