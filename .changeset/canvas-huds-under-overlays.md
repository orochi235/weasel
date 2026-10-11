---
'@weasel-js/core': patch
---

The canvas debug HUDs (`CursorCoordsHud`, `PickHud`, `ModalityHud`) no longer draw over a modal. They sat at `z-index: 10000`, above `Dialog`'s 1000, so an open dialog had the readouts painted across it. They are now at 900.
