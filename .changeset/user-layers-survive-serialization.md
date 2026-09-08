---
'@weasel-js/core': patch
---

A user layer survives `toJSON()` — its name, and the fact that it is a user
layer at all.

Every layer was written to a snapshot as `{ id, visible, locked }` and read back
as `kind: 'system'`, so reloading a document renamed nothing, showed nothing in
a layer list, and made `renameLayer` throw "cannot rename system layer" on a
layer the user had just created.

`SerializedLayer` is the snapshot's layer shape: the fields it always had, plus
an optional `kind` and `name`. A snapshot written before this carries neither
and loads as system layers, which is what every layer in it was.

`sceneFromJSON` now builds an empty scene and calls `loadState`, so the layer
stack is rebuilt by the one reader that knows how instead of by `createScene`,
which mints system layers only.
