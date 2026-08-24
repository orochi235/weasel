---
'@weasel-js/core': patch
'@weasel-js/history': patch
---

Put the selection on the scene, and restore it on undo.

`scene.getSelection()` / `scene.setSelection()` own the transient set of active
ids. It is not document content — `toJSON` never carries it — but every history
entry now records the selection its edit was made under, so undo and redo put
back what was selected. Changing the selection is still never an undo step of
its own.

Undoing a boolean op used to leave the selection pointing at the result node
undo had just deleted; deleting a multi-selection and undoing left it empty.

`useSelection({ scene })` keeps the selection on the scene rather than in the
hook. `<SceneCanvas>` does that by default, so every view over one scene shares
a selection; a `<CanvasView>` opts out with `selection` / `selectionOptions`.

`@weasel-js/history` gains `CreateHistoryOptions.selection`, a get/set pair the
engine reads and writes on the way past — supply it and entries carry
`selectionBefore` / `selectionAfter`, omit it and the engine touches selection
never. `recordEntry` takes the pre-batch selection as an option, because by the
time it runs the live selection has already moved on.

`defaultCommitAdapter` carries `getSelection` / `setSelection` now, so
selection-carrying ops replay without splicing `SelectionApi.adapterMethods`
over it.
