---
'@weasel-js/core': patch
---

Adds API: `useBoneTool({ scene, rig })`, a tool that draws and edits the skeleton in a node's `data.skeleton` on the canvas. `rig` answers the node to edit, usually from the selection; a node with no skeleton gets one when the first bone is drawn. A drag on a joint moves it with the joints under it. A drag from anywhere else draws a bone, from the active joint if there is one and from the press if not. A click picks the active joint or clears it, Delete removes it and everything under it, taking those joints' weights out of every `data.skin` beneath the rig node, and Escape clears it. Each edit is one undo entry. The tool edits the bind pose; its key is J. Mount it with `tools={{ bone }}`.

`createRigEditState()` holds the active joint, to share between this tool and the weight tool. `placeSkeleton(skeleton, pose)` and `unplaceSkeleton` carry a skeleton between a rig node's data and the scene's space, and `createBoneOverlay` is the layer that draws one.
