---
'@weasel-js/core': major
---

The `textEdit` dep and `TextEditDep` belong to `@weasel-js/text-tools`, which adds them to `DepSchema`.

This is breaking: import `TextEditDep` from `@weasel-js/text-tools`, which also puts `'textEdit'` among the dep names an action's `requires` may list. Core's `insert` and `place` no longer open an inserted node for typing themselves; an insert factory says so through `InsertedNode.inserted`, as text's does.

<!-- entry: breaking api -->
