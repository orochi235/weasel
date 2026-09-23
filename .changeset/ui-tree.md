---
'@weasel-js/ui': patch
---

New `Tree`: a hierarchy of expandable rows with WAI-ARIA tree semantics (`tree` / `treeitem` / `group`, `aria-level`, `aria-expanded`, `aria-selected`) and the tree keyboard — Up/Down over visible rows, Right to open or step in, Left to close or step out, Home/End, Enter/Space to activate, and type-ahead. Expansion and selection are each controlled or uncontrolled (`expandedIds` / `defaultExpandedIds` / `onExpandedChange`, `selectedIds` / `defaultSelectedIds` / `onSelectionChange`), with `selectionMode` `'single'` or `'multiple'` (Cmd/Ctrl toggles, Shift extends). Each node takes `leading` and `trailing` decoration, `muted` and `disabled`. Rows are `--wzl-control-h` tall, so they follow density. `filterTree` and `treeBranchIds` cover the usual filter: narrow the nodes, then open every branch that still holds a match.

`DisclosureMark` is the drawn twisty `Disclosure` wears, now exported on its own for a row that is itself the control and so cannot nest a button.
