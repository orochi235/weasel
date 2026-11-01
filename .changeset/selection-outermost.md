---
'@weasel-js/core': patch
'@weasel-js/select': patch
---

A selection never holds a node together with its descendant: a selected node holds its whole subtree, which counts as selected and can't be selected on its own. The scene's selection keeps only the outermost of the ids written to it, whichever order they come in, and drops a node moved under a selected one. `<SceneCanvas>` applies the same rule to a `selection` kept off the scene, on every write the canvas makes. Selecting a group whose child is selected replaces the child with the group, and Shift-clicking a child of a selected group leaves the selection as it was.

`@weasel-js/select` adds `outermost(ids, parentOf)`, the ids no ancestor among them holds, and `holderOf(selected, id, parentOf)`, the selected id that holds `id`: itself or its nearest selected ancestor.
