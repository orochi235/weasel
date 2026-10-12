---
'@weasel-js/core': patch
---

`<SceneCanvas pathEdit>` hands which path is being anchor-edited to the host. This adds API: the `pathEdit` prop and its `PathEditHost` type, `{ editingId(), setEditingId(id) }`. Given one, the canvas keeps no editing id of its own. It reads `editingId()` wherever it needs the open path, and the `enterPathEdit` and `exitPathEdit` actions call `setEditingId`. A host whose own state already names the open path, such as a mode machine holding a path-edit mode's target, passes it so the two cannot disagree. Without the prop the canvas owns the id as before. Added on an agent's judgment.
