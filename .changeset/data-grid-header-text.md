---
'@weasel-js/ui': patch
---

`DataGrid`'s handle and details columns are named in header text a screen reader reads, hidden on screen.

They read "Reorder" and "Details", in place of the old `aria-label`s "drag" and "details".

<!-- entry: fix -->
