---
'@weasel-js/history': patch
---

The docs for `History.serialize()` and `SerializedHistory` called the snapshot structured-clone-safe. It is only as serializable as the op `args` it carries by reference: a scene's remove entry holds a node's live functions, which `JSON.stringify` drops and IndexedDB rejects with `DataCloneError`. The docs now say so.
