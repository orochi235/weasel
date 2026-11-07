---
'@weasel-js/ui': patch
---

`DataGrid`, `ListEditor`, and `TokenField` place the drop seam during a reorder drag by `dropSide` from `@weasel-js/ui-logic`, the rule `ItemList` already uses, instead of each restating it.
