---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A `<CanvasStack>` in a same-origin frame that the embedding page shows enlarged backs its canvases at the scale it is shown at, as it already did under a scaled ancestor in its own document, and measures again on its window's `resize`. A Live lens's copy of an isolated story is drawn sharp at its factor rather than enlarged, and forge sends the copy's frame a `resize` when the lens changes factor.
