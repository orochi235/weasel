---
'@weasel-js/labkit': patch
---

Export the drag-and-drop runtime from `@weasel-js/labkit/dragdrop`

The subpath re-exported three types and no values, so the built
`dist/dragdrop/index.js` was empty and the working runtime sitting beside it was
published from nowhere. It now also exports `useDragDrop`, `DragOverlay`,
`Palette` and `DragGhost`, with their prop and result types: `UseDragDropArgs`,
`UseDragDropResult`, `DragState`, `DragOverlayProps`, `PaletteProps` and
`DragGhostProps`.

A consumer can now drive a palette-to-canvas drag against its own
`DragDropCapability` with the same hook and ghost overlay labkit's instruments
use, instead of reimplementing them. `DragDropCapability`, `DragFeedback` and
`PaletteItem` still export as before, and the root barrel is untouched — the
subpath remains the one place this runtime is published.
