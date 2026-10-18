---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Path constraints can tie nodes together. A constraint link is a scene node: its `dependsOn` names the nodes it ties, and its `data.constraintLink` holds one path constraint whose anchors are numbered over theirs one after another. Being a node, it is saved and undone with the scene, and deleting a node it ties deletes it. Additive, except where noted below.

`@weasel-js/geom` gains `constrainPathsEdit(items, links)`: an edit of several paths finished in one solve, each path's own constraints and each link renumbered through the edit, and the paths the edit left alone held unless nothing else can give way. `constrainPathEdit` is now its one-path case. A solve takes a frame per constraint (`axisAngles`), so paths drawn in different frames solve together. A dragged anchor held on a segment now starts from the nearest point on it and stays there while the rest give way, where before it slid by moving more freely than everything else, which let it drift off the pointer to satisfy unrelated constraints.

In `@weasel-js/core`, a path-edit extension's `finishEdit` gets a fourth argument, a `PathEditFinishCtx` that reads other nodes, their paths and their dependents, and may answer `others`: nodes it changes along with the edited one, each with a new path, data, or `remove`. They are committed in the same history entry, and the anchor drag previews them. The `editAnchors` dep's `finishEdit` now answers `{ path, others }` where it answered the path. This changes its return type.

In `@weasel-js/path-tools`, `constraintLinkNode` makes a link node and `constraintLinkOf` reads one. The constraints extension solves every node links reach from the edited one: an anchor held on another node's segment slides along it when dragged, and follows the segment when that node is edited. Link nodes draw nothing and take no clicks.
