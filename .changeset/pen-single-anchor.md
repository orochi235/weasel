---
'@weasel-js/core': patch
---

`usePenTool`: pressing Enter after one click, or double-clicking an empty canvas with the pen idle, committed a path of a single anchor: a node that draws nothing but sits in the scene and in undo history. Finishing now drops a subpath of fewer than two anchors, and commits nothing when that was all there was.
