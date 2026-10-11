---
'@weasel-js/ui': patch
---

`Tree` selects every visible row on Cmd/Ctrl+A under `selectionMode="multiple"`, reporting the set through `onSelectionChange`. Rows inside a folded branch and disabled rows are left out, as a Shift range leaves them. A single-select tree, and one with no selection, leave the key alone.
