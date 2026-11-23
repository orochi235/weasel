---
'@weasel-js/text-dom': patch
---

`startEdit` on another node while an edit is open commits the open edit first, as clicking away does, instead of dropping what was typed.

Call `cancelEdit()` before `startEdit` to discard it.

<!-- entry: fix behavior -->
