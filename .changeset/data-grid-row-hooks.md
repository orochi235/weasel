---
'@weasel-js/ui': patch
---

`DataGrid` rows can now carry state, be activated, and open a detail row.

- `rowClassName(row)` adds a class to that row's `<tr>`.
- `onRowClick(row)` makes each row focusable and calls back on a click or on Enter/Space. The row keeps its table-row role, and a click on a control inside a cell is left to that control.
- `renderDetail(row)` adds a leading disclosure column and renders a full-width row under each expanded row. Expansion is uncontrolled (`defaultExpandedIds`) or controlled (`expandedIds` + `onExpandedChange`); `rowExpandable(row)` hides the disclosure on rows with nothing to show. Detail rows stay under their parent when the grid is sorted, and drag reordering ignores them.
- `useReorderDragList` takes a `rowSelector` for a container whose children are not all rows.
