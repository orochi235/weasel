---
'@weasel-js/svg': patch
---

`parseSvg` moves and scales a pattern fill's tile with the transforms of the shape it fills, as a browser draws it.

An imported pattern is now placed in the user space of the shape it fills, so it travels with the imported node.

<!-- entry: fix data visual -->
