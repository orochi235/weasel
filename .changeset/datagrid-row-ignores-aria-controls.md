---
'@weasel-js/ui': patch
---

`DataGrid` no longer calls `onRowClick` for a click on a cell's ARIA-role or `tabindex` control.

A `role="switch"`, `checkbox`, `link`, `tab`, `menuitem` and the like, and any element with a `tabindex`, keep the click or key to themselves.

<!-- entry: fix -->
