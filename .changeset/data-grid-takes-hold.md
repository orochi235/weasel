---
'@weasel-js/ui': minor
---

`DataGrid` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Held either way, its drag handles move nothing. Disabled, rows do not sort, expand, or activate either, and with no reason anywhere they leave the tab order; read-only, they still do. Controls drawn in its cells are held with it.

<!-- entry: api new -->
