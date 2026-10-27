---
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

A node properties schema can name a field the node declares for its children as a leaf key: `clip`, or `units` and paths inside it. `SelectionPanel` reads the field off the node and writes it through `scene.setClip` or `scene.setUnits`, one undo step per edit, so a boolean leaf keyed `clip` with an encoding of `'outline'` switches a group's clip.
